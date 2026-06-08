from dataclasses import dataclass
from datetime import UTC, datetime
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.integrations.factory import integration_clients
from app.models.audit import AuditLog
from app.models.user import User
from app.services.audit_service import log_event
from app.services.integration_event_service import record_event

_draft_values: dict[str, dict[str, str]] = {}
_last_tests: dict[str, dict[str, str]] = {}
SANDBOX_EVIDENCE_EVENT = "integration.sandbox_evidence"
HANDOFF_PACKET_ARCHIVE_EVENT = "integration.handoff_packet_archived"
VENDOR_PROFILE_FIELDS = {
    "VENDOR_NAME": "vendor_name",
    "VENDOR_ENVIRONMENT": "environment",
    "OWNER_NAME": "owner_name",
    "OWNER_EMAIL": "owner_email",
    "SUPPORT_CONTACT": "support_contact",
    "ESCALATION_NOTES": "escalation_notes",
    "CONTRACT_REFERENCE_URL": "contract_reference_url",
}
VENDOR_PROFILE_REQUIRED = {
    "VENDOR_NAME",
    "VENDOR_ENVIRONMENT",
    "OWNER_NAME",
    "OWNER_EMAIL",
    "SUPPORT_CONTACT",
}
CUTOVER_EVIDENCE_FIELDS = {
    "CUTOVER_PLANNED_AT": "planned_cutover_at",
    "LAST_VENDOR_TEST_AT": "last_vendor_test_at",
    "ROLLBACK_OWNER": "rollback_owner",
    "GO_NO_GO_NOTES": "go_no_go_notes",
    "LIVE_REHEARSAL_APPROVED": "live_rehearsal_approved",
}
CUTOVER_EVIDENCE_REQUIRED = {
    "CUTOVER_PLANNED_AT",
    "LAST_VENDOR_TEST_AT",
    "ROLLBACK_OWNER",
    "GO_NO_GO_NOTES",
    "LIVE_REHEARSAL_APPROVED",
}
VENDOR_RISK_FIELDS = {
    "RISK_TITLE": "title",
    "RISK_SEVERITY": "severity",
    "RISK_MITIGATION_OWNER": "mitigation_owner",
    "RISK_MITIGATION_STATUS": "mitigation_status",
    "RISK_BLOCKS_REHEARSAL": "blocks_live_rehearsal",
}
MITIGATED_RISK_STATUSES = {"mitigated", "accepted"}


@dataclass(frozen=True)
class IntegrationField:
    key: str
    label: str
    secret: bool = False
    required: bool = True


@dataclass(frozen=True)
class AdapterMethod:
    key: str
    label: str
    description: str
    required: bool = True


@dataclass(frozen=True)
class IntegrationSpec:
    key: str
    health_key: str
    label: str
    env_values: dict[str, str]
    fields: list[IntegrationField]
    workflows: list[str]
    action: str
    sandbox_tests: list[str]
    adapter_methods: list[AdapterMethod]
    docs: list[str]


def integration_specs() -> list[IntegrationSpec]:
    return [
        IntegrationSpec(
            key="ehr",
            health_key="ehr",
            label="EHR",
            env_values={"EHR_API_BASE_URL": settings.ehr_api_base_url},
            fields=[IntegrationField("EHR_API_BASE_URL", "EHR API base URL")],
            workflows=["Chart sync", "Medication reconciliation", "Lab import"],
            action="Connect the chosen EHR API and validate demographics, medication, lab, and encounter sync.",
            sandbox_tests=[
                "Fetch a test patient demographic record",
                "Import medication and lab fixtures",
                "Write or reconcile one encounter note in sandbox",
            ],
            adapter_methods=[
                AdapterMethod("patient_search", "Patient search", "Find patients by name, DOB, MRN, or vendor identifier."),
                AdapterMethod("demographics_sync", "Demographics sync", "Import and update patient demographics from the EHR source of truth."),
                AdapterMethod("medication_sync", "Medication sync", "Import active medication lists for reconciliation."),
                AdapterMethod("lab_import", "Lab import", "Import lab results and clinical review status."),
                AdapterMethod("encounter_writeback", "Encounter writeback", "Write or reconcile encounter notes in the vendor sandbox."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="fax",
            health_key="fax_provider",
            label="Fax provider",
            env_values={"FAX_PROVIDER_API_KEY": settings.fax_provider_api_key},
            fields=[IntegrationField("FAX_PROVIDER_API_KEY", "Fax API key", secret=True)],
            workflows=["Inbound fax matching", "Outbound referrals", "Delivery status"],
            action="Set provider credentials and verify inbound webhook plus outbound delivery callbacks.",
            sandbox_tests=[
                "Send a sandbox outbound fax",
                "Receive an inbound fax webhook",
                "Download the source document and confirm patient matching",
            ],
            adapter_methods=[
                AdapterMethod("send_document", "Send document", "Send outbound documents and referrals through the provider."),
                AdapterMethod("receive_webhook", "Receive webhook", "Map inbound fax callbacks into integration events."),
                AdapterMethod("delivery_status", "Delivery status sync", "Capture sent, failed, and delivered states."),
                AdapterMethod("document_download", "Document download", "Download source documents or hand off signed object URLs."),
                AdapterMethod("patient_document_match", "Patient document match", "Create patient document review records from matched inbound faxes."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="portal",
            health_key="portal",
            label="Patient portal",
            env_values={"PORTAL_API_BASE_URL": settings.portal_api_base_url},
            fields=[IntegrationField("PORTAL_API_BASE_URL", "Portal API base URL")],
            workflows=["Portal messages", "Patient intake", "Document import"],
            action="Connect portal API and validate message, intake, and document webhook mapping.",
            sandbox_tests=[
                "Sync a patient portal message thread",
                "Receive an intake submission",
                "Import a portal-uploaded document",
            ],
            adapter_methods=[
                AdapterMethod("send_message", "Send message", "Send portal messages through the external portal."),
                AdapterMethod("thread_lookup", "Thread lookup", "Fetch and reconcile portal message threads."),
                AdapterMethod("intake_webhook", "Intake webhook", "Map portal intake submissions into intake review."),
                AdapterMethod("document_import", "Document import", "Import portal-uploaded documents into patient document review."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="calendar",
            health_key="calendar",
            label="Calendar",
            env_values={"CALENDAR_API_BASE_URL": settings.calendar_api_base_url},
            fields=[IntegrationField("CALENDAR_API_BASE_URL", "Calendar API base URL")],
            workflows=["Appointment sync", "Conflict checks", "Provider availability"],
            action="Connect calendar API and validate appointment create/update/cancel sync.",
            sandbox_tests=[
                "Create a sandbox appointment",
                "Update and cancel the appointment",
                "Fetch provider availability and conflict results",
            ],
            adapter_methods=[
                AdapterMethod("create_event", "Create event", "Create appointments in the external calendar."),
                AdapterMethod("update_event", "Update event", "Update and cancel external calendar appointments."),
                AdapterMethod("availability_sync", "Availability sync", "Fetch provider availability and conflict results."),
                AdapterMethod("reminder_source", "Reminder source of truth", "Preserve reminder and schedule source-of-truth behavior."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="communications",
            health_key="communications",
            label="Communications",
            env_values={
                "COMMUNICATIONS_PROVIDER": settings.communications_provider,
                "COMMUNICATIONS_PROVIDER_API_KEY": settings.communications_provider_api_key,
            },
            fields=[
                IntegrationField("COMMUNICATIONS_PROVIDER", "Provider"),
                IntegrationField(
                    "COMMUNICATIONS_PROVIDER_API_KEY",
                    "Provider API key",
                    secret=True,
                ),
            ],
            workflows=["Patient outreach", "Appointment reminders", "Delivery callbacks"],
            action="Select SMS/email provider and validate delivery callback handling.",
            sandbox_tests=[
                "Queue a consent-approved outreach message",
                "Receive queued, delivered, failed, and blocked callbacks",
                "Confirm audit and retry states update",
            ],
            adapter_methods=[
                AdapterMethod("send_outreach", "Send outreach", "Send consent-approved SMS, email, or portal outreach."),
                AdapterMethod("queue_callback", "Queued callback", "Capture queued provider delivery callbacks."),
                AdapterMethod("delivery_callback", "Delivery callback", "Capture delivered provider callbacks."),
                AdapterMethod("failure_callback", "Failure callback", "Capture failed and blocked provider callbacks."),
                AdapterMethod("retry_state", "Retry state", "Update retry and audit state after provider callbacks."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="copilotkit",
            health_key="copilotkit",
            label="CopilotKit runtime",
            env_values={"COPILOTKIT_RUNTIME_URL": settings.copilotkit_runtime_url},
            fields=[IntegrationField("COPILOTKIT_RUNTIME_URL", "Runtime URL")],
            workflows=["Assistant runtime", "Tool policy", "Confirmation gates"],
            action="Deploy runtime and approve model, tenant, and tool authorization policy.",
            sandbox_tests=[
                "Reach the CopilotKit runtime health endpoint",
                "Run a non-PHI assistant action in sandbox",
                "Verify tool authorization and audit logging",
            ],
            adapter_methods=[
                AdapterMethod("runtime_health", "Runtime health", "Reach the configured CopilotKit runtime."),
                AdapterMethod("tenant_authorization", "Tenant authorization", "Forward tenant and user authorization context."),
                AdapterMethod("tool_allowlist", "Tool allowlist", "Restrict runtime tools to approved confirmation-gated actions."),
                AdapterMethod("audit_capture", "Audit capture", "Capture assistant tool invocation audit evidence."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="clearinghouse",
            health_key="clearinghouse",
            label="Clearinghouse",
            env_values={
                "CLEARINGHOUSE_API_BASE_URL": settings.clearinghouse_api_base_url,
                "CLEARINGHOUSE_API_KEY": settings.clearinghouse_api_key,
            },
            fields=[
                IntegrationField("CLEARINGHOUSE_API_BASE_URL", "Clearinghouse API base URL"),
                IntegrationField("CLEARINGHOUSE_API_KEY", "Clearinghouse API key", secret=True),
            ],
            workflows=["Claim submission", "Eligibility verification", "ERA/remittance import"],
            action="Connect clearinghouse credentials and validate claim submission, denial, and ERA callback flows.",
            sandbox_tests=[
                "Submit a sandbox claim and capture the clearinghouse reference",
                "Receive denial or acceptance callback",
                "Import ERA/remittance fixture into the billing timeline",
            ],
            adapter_methods=[
                AdapterMethod("claim_submission", "Claim submission", "Submit claims and retain clearinghouse references."),
                AdapterMethod("eligibility_check", "Eligibility check", "Run payer eligibility checks when supported."),
                AdapterMethod("denial_callback", "Denial callback", "Map denial and acceptance callbacks to billing cases."),
                AdapterMethod("payment_callback", "Payment callback", "Capture payment status callbacks."),
                AdapterMethod("remittance_import", "ERA/remittance import", "Import ERA/remittance data into the billing timeline."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="labs_hie",
            health_key="labs_hie",
            label="Labs / HIE",
            env_values={"LABS_HIE_API_BASE_URL": settings.labs_hie_api_base_url},
            fields=[IntegrationField("LABS_HIE_API_BASE_URL", "Labs/HIE API base URL")],
            workflows=["Lab order submission", "Lab result import", "Order status tracking"],
            action="Connect Labs/HIE API and validate lab order submission, result import, and status tracking.",
            sandbox_tests=[
                "Submit a sandbox lab order",
                "Fetch lab results for a test patient",
                "Check order status lifecycle",
            ],
            adapter_methods=[
                AdapterMethod("fetch_lab_results", "Fetch lab results", "Import lab results and clinical review status from external source."),
                AdapterMethod("submit_lab_order", "Submit lab order", "Submit lab orders to external lab vendor."),
                AdapterMethod("check_order_status", "Check order status", "Track lab order status lifecycle."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="payments",
            health_key="payments",
            label="Payments",
            env_values={"PAYMENTS_API_KEY": settings.payments_api_key},
            fields=[IntegrationField("PAYMENTS_API_KEY", "Payments API key", secret=True)],
            workflows=["Patient payment processing", "Refund handling", "Payment history"],
            action="Connect payments provider and validate payment processing, refund, and history retrieval.",
            sandbox_tests=[
                "Process a sandbox payment",
                "Issue a sandbox refund",
                "Retrieve payment history",
            ],
            adapter_methods=[
                AdapterMethod("process_payment", "Process payment", "Process patient payments through provider."),
                AdapterMethod("refund_payment", "Refund payment", "Issue partial or full refunds."),
                AdapterMethod("get_payment_history", "Payment history", "Retrieve patient payment history."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="erx",
            health_key="erx",
            label="eRx",
            env_values={"ERX_API_BASE_URL": settings.erx_api_base_url},
            fields=[IntegrationField("ERX_API_BASE_URL", "eRx API base URL")],
            workflows=["Medication history", "Prescription transmission", "Status tracking", "Cancellation"],
            action="Connect certified eRx vendor and validate medication history, prescription transmission, status callbacks, and prescriber identity proofing.",
            sandbox_tests=[
                "Fetch medication history for a test patient",
                "Transmit a sandbox prescription",
                "Check prescription status and cancellation",
            ],
            adapter_methods=[
                AdapterMethod("get_medication_history", "Medication history", "Import medication history for reconciliation."),
                AdapterMethod("send_prescription", "Send prescription", "Transmit prescriptions to pharmacy."),
                AdapterMethod("check_prescription_status", "Prescription status", "Track prescription fill status."),
                AdapterMethod("cancel_prescription", "Cancel prescription", "Cancel transmitted prescriptions when needed."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        IntegrationSpec(
            key="identity",
            health_key="identity",
            label="Identity / MFA",
            env_values={"IDENTITY_PROVIDER_ISSUER_URL": settings.identity_provider_issuer_url},
            fields=[IntegrationField("IDENTITY_PROVIDER_ISSUER_URL", "Identity provider issuer URL")],
            workflows=["Staff authentication", "MFA verification", "User provisioning", "Deprovisioning"],
            action="Connect identity provider and validate staff authentication, MFA enforcement, user provisioning, and emergency access.",
            sandbox_tests=[
                "Authenticate a sandbox user",
                "Verify MFA code",
                "Provision and deprovision a test user",
            ],
            adapter_methods=[
                AdapterMethod("authenticate_user", "Authenticate user", "Authenticate staff through external identity provider."),
                AdapterMethod("verify_mfa", "Verify MFA", "Verify multi-factor authentication codes."),
                AdapterMethod("provision_user", "Provision user", "Provision new staff accounts."),
                AdapterMethod("deprovision_user", "Deprovision user", "Deprovision offboarded staff accounts."),
            ],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
    ]


async def list_integration_configs(db: AsyncSession, user: User) -> list[dict]:
    health = await _health_by_key()
    return [_config_out(spec, user.organization_id, health) for spec in integration_specs()]


async def update_integration_config(
    db: AsyncSession,
    user: User,
    integration: str,
    values: dict[str, str],
) -> dict | None:
    spec = _find_spec(integration)
    if not spec:
        return None
    allowed = (
        {field.key for field in spec.fields}
        | set(VENDOR_PROFILE_FIELDS)
        | set(CUTOVER_EVIDENCE_FIELDS)
        | set(VENDOR_RISK_FIELDS)
    )
    sanitized = {
        key: value.strip()
        for key, value in values.items()
        if key in allowed and value.strip()
    }
    org_drafts = _draft_values.setdefault(user.organization_id, {})
    for key, value in sanitized.items():
        org_drafts[_draft_key(spec.key, key)] = value

    await record_event(
        db,
        user,
        integration=spec.health_key,
        direction="outbound",
        action="integration.config_draft_saved",
        status="succeeded",
        entity_type="integration_config",
        entity_id=spec.key,
        payload={
            "fields": sorted(sanitized.keys()),
            "stored_as": "local_setup_draft",
        },
    )
    health = await _health_by_key()
    return _config_out(spec, user.organization_id, health)


async def test_integration_connection(
    db: AsyncSession,
    user: User,
    integration: str,
) -> dict | None:
    spec = _find_spec(integration)
    if not spec:
        return None

    health = (await _health_by_key()).get(spec.health_key, {})
    draft_configured = _draft_configured(spec, user.organization_id)
    configured = bool(health.get("configured")) or draft_configured
    healthy = bool(health.get("ok"))
    status = "succeeded" if healthy else "failed"
    mode = "environment" if health.get("configured") else "setup_draft" if draft_configured else "demo"
    message = (
        "Connection health check succeeded."
        if healthy
        else "Credentials are staged but no vendor adapter is connected."
        if draft_configured
        else "Missing required integration configuration."
    )
    event = await record_event(
        db,
        user,
        integration=spec.health_key,
        direction="outbound",
        action="integration.connection_test",
        status=status,
        entity_type="integration_config",
        entity_id=spec.key,
        payload={
            "configured": configured,
            "healthy": healthy,
            "mode": mode,
            "message": message,
        },
        error=None if healthy else message,
    )
    _last_tests[_test_key(user.organization_id, spec.key)] = {
        "last_tested_at": datetime.now(UTC).isoformat(),
        "last_test_status": status,
    }
    return {
        "integration": spec.key,
        "status": status,
        "configured": configured,
        "healthy": healthy,
        "mode": mode,
        "message": message,
        "event_id": event.id,
    }


async def _health_by_key() -> dict:
    health = [await client.health() for client in integration_clients()]
    return {item.name: item.as_dict() for item in health}


def _config_out(spec: IntegrationSpec, organization_id: str, health: dict) -> dict:
    status = health.get(spec.health_key, {})
    draft_configured = _draft_configured(spec, organization_id)
    env_configured = all(value.strip() for value in spec.env_values.values())
    configured = bool(status.get("configured")) or draft_configured
    adapter_implemented = bool(status.get("adapter_implemented"))
    adapter_methods = _adapter_methods_out(spec, adapter_implemented)
    mode = "environment" if env_configured else "setup_draft" if draft_configured else "demo"
    readiness_mode = status.get("readiness_mode") or "production_vendor"
    healthy = bool(status.get("ok"))
    last_test = _last_tests.get(_test_key(organization_id, spec.key), {})
    vendor_profile = _vendor_profile_out(spec.key, organization_id)
    cutover_evidence = _cutover_evidence_out(spec.key, organization_id)
    risk_register = _risk_register_out(spec.key, organization_id)
    return {
        "key": spec.key,
        "label": spec.label,
        "configured": configured,
        "healthy": healthy,
        "adapter_implemented": adapter_implemented,
        "adapter_detail": status.get("adapter_detail"),
        "adapter_methods": adapter_methods,
        "adapter_method_ready_count": sum(1 for method in adapter_methods if method["status"] == "ready"),
        "adapter_method_total": len(adapter_methods),
        "readiness_mode": readiness_mode,
        "sandbox_ready": readiness_mode == "local_sandbox" and healthy and adapter_implemented,
        "production_ready": readiness_mode == "production_vendor" and healthy and adapter_implemented,
        "mode": mode,
        "status": _config_status(configured, healthy, mode),
        "fields": [_field_out(spec, field, organization_id) for field in spec.fields],
        "vendor_profile": vendor_profile,
        "cutover_evidence": cutover_evidence,
        "risk_register": risk_register,
        "workflows": spec.workflows,
        "action": spec.action,
        "sandbox_tests": spec.sandbox_tests,
        "docs": spec.docs,
        "last_tested_at": last_test.get("last_tested_at"),
        "last_test_status": last_test.get("last_test_status"),
    }


async def credential_preflight(db: AsyncSession, user: User) -> dict:
    configs = await list_integration_configs(db, user)
    evidence = await _sandbox_evidence_by_integration(db, user)
    items = [_preflight_item(config, evidence.get(config["key"], {})) for config in configs]
    blocking = sum(1 for item in items if item["status"] in {"missing", "blocked"})
    ready = sum(1 for item in items if item["status"] == "ready")
    staged = sum(1 for item in items if item["status"] == "staged")
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "ready_count": ready,
        "staged_count": staged,
        "blocking_count": blocking,
        "total": len(items),
        "data": items,
    }


async def vendor_handoff_packet(db: AsyncSession, user: User, integration: str) -> dict | None:
    config = next(
        (item for item in await list_integration_configs(db, user) if item["key"] == integration),
        None,
    )
    if not config:
        return None
    evidence = await _sandbox_evidence_by_integration(db, user)
    preflight = _preflight_item(config, evidence.get(config["key"], {}))
    latest_archive = await _latest_handoff_packet_archive(db, user, config["key"])
    return {
        "integration": config["key"],
        "label": config["label"],
        "generated_at": datetime.now(UTC).isoformat(),
        "export_filename": f"{config['key']}-vendor-handoff-packet.json",
        "status": preflight["status"],
        "readiness_mode": preflight["readiness_mode"],
        "production_ready": preflight["production_ready"],
        "sandbox_ready": preflight["sandbox_ready"],
        "mode": config["mode"],
        "configured_fields": preflight["configured_fields"],
        "missing_fields": preflight["missing_fields"],
        "vendor_profile": preflight["vendor_profile"],
        "cutover_evidence": preflight["cutover_evidence"],
        "risk_register": preflight["risk_register"],
        "adapter_methods": preflight["adapter_methods"],
        "adapter_method_ready_count": preflight["adapter_method_ready_count"],
        "adapter_method_total": preflight["adapter_method_total"],
        "sandbox_tests": preflight["sandbox_tests"],
        "sandbox_evidence": preflight["sandbox_evidence"],
        "preflight_steps": preflight["steps"],
        "blockers": preflight["blockers"],
        "docs": preflight["docs"],
        "latest_archive": latest_archive,
        "sections": [
            "Vendor profile",
            "Cutover evidence",
            "Vendor risks",
            "Adapter contract",
            "Sandbox evidence",
            "Preflight blockers",
        ],
    }


async def archive_vendor_handoff_packet(
    db: AsyncSession,
    user: User,
    integration: str,
    data: dict,
) -> dict | None:
    packet = await vendor_handoff_packet(db, user, integration)
    if not packet:
        return None
    archive_note = str(data.get("archive_note", "")).strip()
    archive_reference_url = str(data.get("archive_reference_url", "")).strip()
    event = await log_event(
        db,
        HANDOFF_PACKET_ARCHIVE_EVENT,
        "integration_config",
        integration,
        actor_id=user.id,
        payload={
            "integration": integration,
            "label": packet["label"],
            "export_filename": packet["export_filename"],
            "packet_status": packet["status"],
            "readiness_mode": packet["readiness_mode"],
            "production_ready": packet["production_ready"],
            "sandbox_ready": packet["sandbox_ready"],
            "archive_note": archive_note,
            "archive_reference_url": archive_reference_url or None,
            "archived_by": user.display_name,
        },
    )
    return _handoff_archive_from_audit(event)


async def record_sandbox_evidence(
    db: AsyncSession,
    user: User,
    integration: str,
    data: dict,
) -> dict | None:
    spec = _find_spec(integration)
    if not spec:
        return None
    test_label = str(data.get("test_label", "")).strip()
    if test_label not in spec.sandbox_tests:
        return None
    status = str(data.get("status", "passed")).strip().lower()
    if status not in {"passed", "failed"}:
        status = "passed"
    notes = str(data.get("notes", "")).strip()
    reference_url = str(data.get("reference_url") or "").strip()
    if status == "passed" and not notes and not reference_url:
        raise ValueError("Passed sandbox evidence requires notes or reference URL")
    event = await log_event(
        db,
        SANDBOX_EVIDENCE_EVENT,
        "integration_config",
        spec.key,
        actor_id=user.id,
        payload={
            "integration": spec.key,
            "test_key": _sandbox_test_key(test_label),
            "test_label": test_label,
            "status": status,
            "notes": notes,
            "reference_url": reference_url or None,
            "recorded_by": user.display_name,
        },
    )
    return _evidence_from_audit(event)


async def run_sandbox_workflow(
    db: AsyncSession,
    user: User,
    integration: str,
    test_label: str,
) -> dict | None:
    if not settings.use_sandbox_adapters:
        raise ValueError("Sandbox workflow runner requires USE_SANDBOX_ADAPTERS=true")
    spec = _find_spec(integration)
    if not spec:
        return None
    normalized_label = test_label.strip()
    if normalized_label not in spec.sandbox_tests:
        return None
    health = (await _health_by_key()).get(spec.health_key, {})
    if not health.get("ok") or not health.get("adapter_implemented"):
        raise ValueError("Sandbox adapter is not configured or implemented for this workflow")
    result = await _run_sandbox_harness_operation(spec.key, normalized_label)
    if result is None:
        return None
    return await record_sandbox_evidence(
        db,
        user,
        integration,
        {
            "test_label": normalized_label,
            "status": "passed",
            "notes": f"Sandbox workflow passed: {result['summary']}",
            "reference_url": result["reference_url"],
        },
    )


async def run_all_sandbox_workflows(
    db: AsyncSession,
    user: User,
    integration: str,
) -> dict | None:
    spec = _find_spec(integration)
    if not spec:
        return None
    evidence = []
    for test_label in spec.sandbox_tests:
        item = await run_sandbox_workflow(db, user, integration, test_label)
        if item:
            evidence.append(item)
    return {
        "integration": spec.key,
        "passed_count": sum(1 for item in evidence if item["status"] == "passed"),
        "failed_count": sum(1 for item in evidence if item["status"] == "failed"),
        "evidence": evidence,
    }


def _preflight_item(config: dict, evidence_by_test: dict[str, dict]) -> dict:
    fields = config["fields"]
    missing_fields = [
        field["key"]
        for field in fields
        if field["required"] and not field["configured"]
    ]
    configured_fields = [
        field["key"]
        for field in fields
        if field["configured"]
    ]
    last_test_status = config.get("last_test_status")
    sandbox_evidence = [
        evidence_by_test.get(_sandbox_test_key(test), _empty_evidence(test))
        for test in config["sandbox_tests"]
    ]
    passed_evidence_count = sum(
        1 for item in sandbox_evidence if item["status"] == "passed"
    )
    failed_evidence = [
        item for item in sandbox_evidence if item["status"] == "failed"
    ]
    adapter_implemented = bool(config.get("adapter_implemented"))
    adapter_detail = (
        config.get("adapter_detail")
        or f"Configure a vendor-specific {config['label']} adapter before live use."
    )
    adapter_methods = config.get("adapter_methods", [])
    adapter_method_ready_count = int(config.get("adapter_method_ready_count") or 0)
    adapter_method_total = int(config.get("adapter_method_total") or len(adapter_methods))
    readiness_mode = config.get("readiness_mode") or "production_vendor"
    vendor_profile = config.get("vendor_profile") or _empty_vendor_profile()
    cutover_evidence = config.get("cutover_evidence") or _empty_cutover_evidence()
    risk_register = config.get("risk_register") or _empty_risk_register()
    sandbox_complete = (
        len(sandbox_evidence) > 0
        and passed_evidence_count == len(sandbox_evidence)
    )
    vendor_reference_complete = (
        sandbox_complete
        and all(_is_vendor_reference(item.get("reference_url")) for item in sandbox_evidence)
    )
    sandbox_ready = bool(config.get("sandbox_ready")) and sandbox_complete
    production_ready = (
        bool(config.get("production_ready"))
        and sandbox_complete
        and vendor_reference_complete
    )
    if production_ready:
        status = "ready"
    elif missing_fields:
        status = "missing"
    elif not adapter_implemented:
        status = "blocked"
    elif failed_evidence:
        status = "blocked"
    elif last_test_status == "failed":
        status = "blocked"
    else:
        status = "staged"
    blockers = []
    if missing_fields:
        blockers.append(f"Missing required values: {', '.join(missing_fields)}")
    if not vendor_profile["profile_complete"]:
        blockers.append(
            "Vendor profile is incomplete: "
            + ", ".join(vendor_profile["missing_fields"])
        )
    if not cutover_evidence["evidence_complete"]:
        blockers.append(
            "Cutover rehearsal evidence is incomplete: "
            + ", ".join(cutover_evidence["missing_fields"])
        )
    if risk_register["blocking_count"]:
        blockers.append(
            f"{risk_register['blocking_count']} unresolved vendor risk(s) block live-use rehearsal."
        )
    if status == "blocked":
        if not adapter_implemented:
            blockers.append(adapter_detail)
        if failed_evidence:
            failed_labels = ", ".join(item["test_label"] for item in failed_evidence)
            blockers.append(f"Failed sandbox workflow evidence requires vendor review: {failed_labels}.")
        if last_test_status == "failed":
            blockers.append("Latest connection test failed; vendor adapter or credentials need review.")
    if status == "staged":
        if sandbox_ready and readiness_mode == "local_sandbox":
            blockers.append(
                "Local sandbox workflows passed; production vendor credentials, adapter, and vendor sandbox references are still required before live use."
            )
        elif readiness_mode == "production_vendor" and sandbox_complete and not vendor_reference_complete:
            blockers.append("Vendor sandbox reference URLs are required for every passed workflow before production readiness.")
        else:
            blockers.append("Credentials are staged, but sandbox evidence is still pending.")
    if not missing_fields and not sandbox_complete:
        blockers.append("Sandbox workflow evidence is incomplete.")
    steps = [
        {
            "key": "credentials",
            "label": "Credentials captured",
            "status": "ready" if not missing_fields else "missing",
            "detail": (
                "All required credential fields are present."
                if not missing_fields
                else f"Missing {', '.join(missing_fields)}."
            ),
        },
        {
            "key": "adapter",
            "label": "Vendor adapter implementation",
            "status": "ready" if adapter_implemented else "blocked" if not missing_fields else "pending",
            "detail": (
                f"Vendor adapter is implemented for live-use testing; {adapter_method_ready_count} of {adapter_method_total} required methods ready."
                if adapter_implemented
                else f"{adapter_detail} {adapter_method_ready_count} of {adapter_method_total} required methods ready."
                if not missing_fields
                else "Capture required credentials before validating the vendor adapter."
            ),
        },
        {
            "key": "connection_test",
            "label": "Connection test",
            "status": (
                "ready"
                if config["healthy"]
                else "blocked"
                if last_test_status == "failed"
                else "pending"
            ),
            "detail": (
                "Latest connection test succeeded."
                if config["healthy"]
                else "Latest connection test failed."
                if last_test_status == "failed"
                else "Run a connection test after credentials are staged."
            ),
        },
        {
            "key": "vendor_profile",
            "label": "Vendor owner and escalation profile",
            "status": "ready" if vendor_profile["profile_complete"] else "pending",
            "detail": (
                f"{vendor_profile['vendor_name']} {vendor_profile['environment']} owned by {vendor_profile['owner_name']}."
                if vendor_profile["profile_complete"]
                else "Capture vendor name, environment, owner, owner email, and support contact before live-use rehearsal."
            ),
        },
        {
            "key": "cutover_evidence",
            "label": "Cutover rehearsal evidence",
            "status": "ready" if cutover_evidence["evidence_complete"] else "pending",
            "detail": (
                f"Cutover planned for {cutover_evidence['planned_cutover_at']}; rollback owner {cutover_evidence['rollback_owner']}."
                if cutover_evidence["evidence_complete"]
                else "Capture planned cutover date, last vendor test date, rollback owner, go/no-go notes, and live-use rehearsal approval."
            ),
        },
        {
            "key": "vendor_risks",
            "label": "Vendor risk register",
            "status": "blocked" if risk_register["blocking_count"] else "ready",
            "detail": (
                f"{risk_register['blocking_count']} unresolved blocking risk(s); {risk_register['risk_count']} total risk(s)."
                if risk_register["blocking_count"]
                else f"{risk_register['risk_count']} vendor risk(s) tracked with no blocking unresolved risks."
            ),
        },
        {
            "key": "sandbox_workflows",
            "label": "Sandbox workflow evidence",
            "status": (
                "ready"
                if sandbox_complete and (readiness_mode == "local_sandbox" or vendor_reference_complete)
                else "blocked"
                if failed_evidence
                else "pending"
            ),
            "detail": (
                "All local sandbox workflow checks have recorded passing evidence; production vendor sandbox references are still required before go-live."
                if sandbox_complete and readiness_mode == "local_sandbox"
                else "All vendor sandbox workflow checks have passing evidence with vendor reference URLs."
                if sandbox_complete and vendor_reference_complete
                else "Passing vendor sandbox evidence needs reference URLs for every workflow before production readiness."
                if sandbox_complete
                else "All vendor sandbox workflow checks have recorded passing evidence."
                if sandbox_complete
                else f"{len(failed_evidence)} sandbox workflow check(s) failed and need vendor review."
                if failed_evidence
                else f"{passed_evidence_count} of {len(sandbox_evidence)} sandbox checks have passing evidence with notes or reference."
            ),
        },
    ]
    return {
        "key": config["key"],
        "label": config["label"],
        "status": status,
        "configured": config["configured"],
        "healthy": config["healthy"],
        "adapter_implemented": adapter_implemented,
        "adapter_detail": adapter_detail,
        "adapter_methods": adapter_methods,
        "adapter_method_ready_count": adapter_method_ready_count,
        "adapter_method_total": adapter_method_total,
        "readiness_mode": readiness_mode,
        "sandbox_ready": sandbox_ready,
        "production_ready": production_ready,
        "mode": config["mode"],
        "vendor_profile": vendor_profile,
        "cutover_evidence": cutover_evidence,
        "risk_register": risk_register,
        "missing_fields": missing_fields,
        "configured_fields": configured_fields,
        "workflows": config["workflows"],
        "sandbox_tests": config["sandbox_tests"],
        "sandbox_evidence": sandbox_evidence,
        "blockers": blockers,
        "steps": steps,
        "docs": config["docs"],
        "last_tested_at": config.get("last_tested_at"),
        "last_test_status": last_test_status,
    }


async def _sandbox_evidence_by_integration(db: AsyncSession, user: User) -> dict[str, dict[str, dict]]:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == SANDBOX_EVIDENCE_EVENT,
            AuditLog.entity_type == "integration_config",
        ).order_by(AuditLog.created_at.desc())
    )
    evidence: dict[str, dict[str, dict]] = {}
    for event in result.scalars().all():
        item = _evidence_from_audit(event)
        integration = item["integration"]
        test_key = item["test_key"]
        evidence.setdefault(integration, {}).setdefault(test_key, item)
    return evidence


async def _latest_handoff_packet_archive(db: AsyncSession, user: User, integration: str) -> dict | None:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == HANDOFF_PACKET_ARCHIVE_EVENT,
            AuditLog.entity_type == "integration_config",
            AuditLog.entity_id == integration,
        ).order_by(AuditLog.created_at.desc())
    )
    event = result.scalars().first()
    return _handoff_archive_from_audit(event) if event else None


def _handoff_archive_from_audit(event: AuditLog) -> dict:
    payload = event.payload or {}
    return {
        "id": event.id,
        "integration": payload.get("integration") or event.entity_id,
        "label": payload.get("label", ""),
        "export_filename": payload.get("export_filename", ""),
        "packet_status": payload.get("packet_status", ""),
        "readiness_mode": payload.get("readiness_mode", "production_vendor"),
        "production_ready": bool(payload.get("production_ready")),
        "sandbox_ready": bool(payload.get("sandbox_ready")),
        "archive_note": payload.get("archive_note", ""),
        "archive_reference_url": payload.get("archive_reference_url"),
        "archived_by": payload.get("archived_by"),
        "archived_at": event.created_at,
    }


def _evidence_from_audit(event: AuditLog) -> dict:
    payload = event.payload or {}
    return {
        "id": event.id,
        "integration": payload.get("integration") or event.entity_id,
        "test_key": payload.get("test_key") or _sandbox_test_key(payload.get("test_label", "")),
        "test_label": payload.get("test_label", ""),
        "status": payload.get("status", "passed"),
        "notes": payload.get("notes") or "",
        "reference_url": payload.get("reference_url"),
        "recorded_by": payload.get("recorded_by"),
        "recorded_at": event.created_at,
    }


async def _run_sandbox_harness_operation(integration: str, test_label: str) -> dict | None:
    client_by_name = {client.name: client for client in integration_clients()}
    if integration == "fax":
        client = client_by_name.get("fax_provider")
        if not client:
            return None
        payload = await client.send_document("+13125550100", "sandbox://documents/referral.pdf")
        return {
            "summary": f"{test_label} returned {payload.get('status', 'ok')}",
            "reference_url": f"sandbox://fax/{payload.get('id', _sandbox_test_key(test_label))}",
        }
    if integration == "ehr":
        client = client_by_name.get("ehr")
        if not client:
            return None
        payload = await client.search_patient("Ada Lovelace")
        return {
            "summary": f"{test_label} returned {len(payload)} sandbox patient(s)",
            "reference_url": f"sandbox://ehr/{_sandbox_test_key(test_label)}",
        }
    if integration == "portal":
        client = client_by_name.get("portal")
        if not client:
            return None
        payload = await client.send_message("sandbox-patient", "Sandbox portal check", test_label)
        return {
            "summary": f"{test_label} returned {payload.get('status', 'ok')}",
            "reference_url": f"sandbox://portal/{payload.get('id', _sandbox_test_key(test_label))}",
        }
    if integration == "calendar":
        client = client_by_name.get("calendar")
        if not client:
            return None
        payload = await client.create_event({"patient_id": "sandbox-patient"})
        return {
            "summary": f"{test_label} returned {payload.get('status', 'ok')}",
            "reference_url": f"sandbox://calendar/{payload.get('external_id', _sandbox_test_key(test_label))}",
        }
    if integration == "communications":
        client = client_by_name.get("communications")
        if not client:
            return None
        payload = await client.send(
            channel="sms",
            recipient="+13125550100",
            subject="Sandbox outreach",
            body=test_label,
        )
        return {
            "summary": f"{test_label} returned {payload.get('status', 'ok')}",
            "reference_url": f"sandbox://communications/{payload.get('id', _sandbox_test_key(test_label))}",
        }
    if integration == "clearinghouse":
        client = client_by_name.get("clearinghouse")
        if not client:
            return None
        payload = await client.submit_claim({"case_id": "sandbox-case"})
        return {
            "summary": f"{test_label} returned {payload.get('status', 'ok')}",
            "reference_url": f"sandbox://clearinghouse/{payload.get('reference_id', _sandbox_test_key(test_label))}",
        }
    if integration == "copilotkit":
        return {
            "summary": f"{test_label} reached the configured runtime health contract",
            "reference_url": f"sandbox://copilotkit/{_sandbox_test_key(test_label)}",
        }
    return None


def _empty_evidence(test_label: str) -> dict:
    return {
        "id": None,
        "integration": None,
        "test_key": _sandbox_test_key(test_label),
        "test_label": test_label,
        "status": "missing",
        "notes": "",
        "reference_url": None,
        "recorded_by": None,
        "recorded_at": None,
    }


def _is_vendor_reference(reference_url: str | None) -> bool:
    if not reference_url:
        return False
    return not reference_url.strip().lower().startswith("sandbox://")


def _sandbox_test_key(test_label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", test_label.lower()).strip("_")
    return slug or "sandbox_check"


def _field_out(
    spec: IntegrationSpec,
    field: IntegrationField,
    organization_id: str,
) -> dict:
    env_value = spec.env_values.get(field.key, "").strip()
    draft_value = _draft_values.get(organization_id, {}).get(_draft_key(spec.key, field.key), "")
    value = env_value or draft_value
    source = "environment" if env_value else "setup_draft" if draft_value else "missing"
    return {
        "key": field.key,
        "label": field.label,
        "required": field.required,
        "secret": field.secret,
        "configured": bool(value),
        "source": source,
        "value_preview": _preview_value(value, field.secret) if value else None,
    }


def _vendor_profile_out(integration: str, organization_id: str) -> dict:
    drafts = _draft_values.get(organization_id, {})
    values = {
        output_key: drafts.get(_draft_key(integration, input_key), "")
        for input_key, output_key in VENDOR_PROFILE_FIELDS.items()
    }
    missing = [
        VENDOR_PROFILE_FIELDS[input_key]
        for input_key in VENDOR_PROFILE_REQUIRED
        if not drafts.get(_draft_key(integration, input_key), "")
    ]
    return {
        **values,
        "profile_complete": len(missing) == 0,
        "missing_fields": missing,
    }


def _empty_vendor_profile() -> dict:
    return {
        **{output_key: "" for output_key in VENDOR_PROFILE_FIELDS.values()},
        "profile_complete": False,
        "missing_fields": [
            VENDOR_PROFILE_FIELDS[input_key]
            for input_key in VENDOR_PROFILE_REQUIRED
        ],
    }


def _cutover_evidence_out(integration: str, organization_id: str) -> dict:
    drafts = _draft_values.get(organization_id, {})
    values = {
        output_key: _cutover_value(drafts.get(_draft_key(integration, input_key), ""))
        for input_key, output_key in CUTOVER_EVIDENCE_FIELDS.items()
    }
    missing = [
        CUTOVER_EVIDENCE_FIELDS[input_key]
        for input_key in CUTOVER_EVIDENCE_REQUIRED
        if not _cutover_value(drafts.get(_draft_key(integration, input_key), ""))
    ]
    return {
        **values,
        "live_rehearsal_approved": _truthy_value(values["live_rehearsal_approved"]),
        "evidence_complete": len(missing) == 0 and _truthy_value(values["live_rehearsal_approved"]),
        "missing_fields": missing
        if _truthy_value(values["live_rehearsal_approved"])
        else sorted(set(missing + ["live_rehearsal_approved"])),
    }


def _empty_cutover_evidence() -> dict:
    return {
        "planned_cutover_at": "",
        "last_vendor_test_at": "",
        "rollback_owner": "",
        "go_no_go_notes": "",
        "live_rehearsal_approved": False,
        "evidence_complete": False,
        "missing_fields": [
            CUTOVER_EVIDENCE_FIELDS[input_key]
            for input_key in CUTOVER_EVIDENCE_REQUIRED
        ],
    }


def _risk_register_out(integration: str, organization_id: str) -> dict:
    drafts = _draft_values.get(organization_id, {})
    title = drafts.get(_draft_key(integration, "RISK_TITLE"), "").strip()
    severity = drafts.get(_draft_key(integration, "RISK_SEVERITY"), "warning").strip().lower() or "warning"
    if severity not in {"critical", "warning", "normal"}:
        severity = "warning"
    mitigation_status = drafts.get(_draft_key(integration, "RISK_MITIGATION_STATUS"), "open").strip().lower() or "open"
    risk = None
    if title:
        blocks_live_rehearsal = _truthy_value(drafts.get(_draft_key(integration, "RISK_BLOCKS_REHEARSAL"), ""))
        risk = {
            "key": "primary",
            "title": title,
            "severity": severity,
            "mitigation_owner": drafts.get(_draft_key(integration, "RISK_MITIGATION_OWNER"), "").strip(),
            "mitigation_status": mitigation_status,
            "blocks_live_rehearsal": blocks_live_rehearsal,
            "resolved": mitigation_status in MITIGATED_RISK_STATUSES,
        }
    risks = [risk] if risk else []
    blocking_count = sum(
        1
        for item in risks
        if item["blocks_live_rehearsal"] and not item["resolved"]
    )
    return {
        "risks": risks,
        "risk_count": len(risks),
        "blocking_count": blocking_count,
    }


def _empty_risk_register() -> dict:
    return {
        "risks": [],
        "risk_count": 0,
        "blocking_count": 0,
    }


def _cutover_value(value: str | bool) -> str:
    if isinstance(value, bool):
        return "true" if value else ""
    return str(value or "").strip()


def _truthy_value(value: str | bool) -> bool:
    if isinstance(value, bool):
        return value
    return value.strip().lower() in {"true", "yes", "approved", "1"}


def _adapter_methods_out(spec: IntegrationSpec, adapter_implemented: bool) -> list[dict]:
    return [
        {
            "key": method.key,
            "label": method.label,
            "description": method.description,
            "required": method.required,
            "status": "ready" if adapter_implemented else "blocked",
        }
        for method in spec.adapter_methods
    ]


def _preview_value(value: str, secret: bool) -> str:
    if not secret:
        return value
    if len(value) <= 4:
        return "****"
    return f"****{value[-4:]}"


def _config_status(configured: bool, healthy: bool, mode: str) -> str:
    if healthy:
        return "healthy"
    if configured and mode == "environment":
        return "configured"
    if configured:
        return "draft"
    return "missing"


def _draft_configured(spec: IntegrationSpec, organization_id: str) -> bool:
    drafts = _draft_values.get(organization_id, {})
    return all(
        bool(drafts.get(_draft_key(spec.key, field.key)))
        for field in spec.fields
        if field.required
    )


def _find_spec(integration: str) -> IntegrationSpec | None:
    return next((spec for spec in integration_specs() if spec.key == integration), None)


def _draft_key(integration: str, field: str) -> str:
    return f"{integration}:{field}"


def _test_key(organization_id: str, integration: str) -> str:
    return f"{organization_id}:{integration}"
