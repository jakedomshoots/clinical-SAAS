from dataclasses import dataclass
from datetime import UTC, datetime
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.integrations.calendar import CalendarClient
from app.integrations.clearinghouse import ClearinghouseClient
from app.integrations.communications import CommunicationsClient
from app.integrations.copilotkit import CopilotRuntimeClient
from app.integrations.ehr import EHRClient
from app.integrations.fax_provider import FaxProviderClient
from app.integrations.portal import PortalClient
from app.models.audit import AuditLog
from app.models.user import User
from app.services.audit_service import log_event
from app.services.integration_event_service import record_event

_draft_values: dict[str, dict[str, str]] = {}
_last_tests: dict[str, dict[str, str]] = {}
SANDBOX_EVIDENCE_EVENT = "integration.sandbox_evidence"


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
    allowed = {field.key for field in spec.fields}
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
    clients = [
        EHRClient(settings.ehr_api_base_url),
        FaxProviderClient(settings.fax_provider_api_key),
        PortalClient(settings.portal_api_base_url),
        CalendarClient(settings.calendar_api_base_url),
        CopilotRuntimeClient(settings.copilotkit_runtime_url),
        CommunicationsClient(settings.communications_provider_api_key),
        ClearinghouseClient(settings.clearinghouse_api_key),
    ]
    health = [await client.health() for client in clients]
    return {item.name: item.as_dict() for item in health}


def _config_out(spec: IntegrationSpec, organization_id: str, health: dict) -> dict:
    status = health.get(spec.health_key, {})
    draft_configured = _draft_configured(spec, organization_id)
    env_configured = all(value.strip() for value in spec.env_values.values())
    configured = bool(status.get("configured")) or draft_configured
    adapter_implemented = bool(status.get("adapter_implemented"))
    adapter_methods = _adapter_methods_out(spec, adapter_implemented)
    mode = "environment" if env_configured else "setup_draft" if draft_configured else "demo"
    last_test = _last_tests.get(_test_key(organization_id, spec.key), {})
    return {
        "key": spec.key,
        "label": spec.label,
        "configured": configured,
        "healthy": bool(status.get("ok")),
        "adapter_implemented": adapter_implemented,
        "adapter_detail": status.get("adapter_detail"),
        "adapter_methods": adapter_methods,
        "adapter_method_ready_count": sum(1 for method in adapter_methods if method["status"] == "ready"),
        "adapter_method_total": len(adapter_methods),
        "mode": mode,
        "status": _config_status(configured, bool(status.get("ok")), mode),
        "fields": [_field_out(spec, field, organization_id) for field in spec.fields],
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
    reference_url = str(data.get("reference_url", "")).strip()
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
    sandbox_complete = (
        len(sandbox_evidence) > 0
        and passed_evidence_count == len(sandbox_evidence)
    )
    if config["healthy"] and adapter_implemented and sandbox_complete:
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
    if status == "blocked":
        if not adapter_implemented:
            blockers.append(adapter_detail)
        if failed_evidence:
            failed_labels = ", ".join(item["test_label"] for item in failed_evidence)
            blockers.append(f"Failed sandbox workflow evidence requires vendor review: {failed_labels}.")
        if last_test_status == "failed":
            blockers.append("Latest connection test failed; vendor adapter or credentials need review.")
    if status == "staged":
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
            "key": "sandbox_workflows",
            "label": "Sandbox workflow evidence",
            "status": "ready" if sandbox_complete else "blocked" if failed_evidence else "pending",
            "detail": (
                "All sandbox workflow checks have recorded passing evidence."
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
        "mode": config["mode"],
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
