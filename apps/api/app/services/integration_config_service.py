from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.integrations.calendar import CalendarClient
from app.integrations.communications import CommunicationsClient
from app.integrations.copilotkit import CopilotRuntimeClient
from app.integrations.ehr import EHRClient
from app.integrations.fax_provider import FaxProviderClient
from app.integrations.portal import PortalClient
from app.models.user import User
from app.services.integration_event_service import record_event

_draft_values: dict[str, dict[str, str]] = {}
_last_tests: dict[str, dict[str, str]] = {}


@dataclass(frozen=True)
class IntegrationField:
    key: str
    label: str
    secret: bool = False
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
        ),
        IntegrationSpec(
            key="fax",
            health_key="fax_provider",
            label="Fax provider",
            env_values={"FAX_PROVIDER_API_KEY": settings.fax_provider_api_key},
            fields=[IntegrationField("FAX_PROVIDER_API_KEY", "Fax API key", secret=True)],
            workflows=["Inbound fax matching", "Outbound referrals", "Delivery status"],
            action="Set provider credentials and verify inbound webhook plus outbound delivery callbacks.",
        ),
        IntegrationSpec(
            key="portal",
            health_key="portal",
            label="Patient portal",
            env_values={"PORTAL_API_BASE_URL": settings.portal_api_base_url},
            fields=[IntegrationField("PORTAL_API_BASE_URL", "Portal API base URL")],
            workflows=["Portal messages", "Patient intake", "Document import"],
            action="Connect portal API and validate message, intake, and document webhook mapping.",
        ),
        IntegrationSpec(
            key="calendar",
            health_key="calendar",
            label="Calendar",
            env_values={"CALENDAR_API_BASE_URL": settings.calendar_api_base_url},
            fields=[IntegrationField("CALENDAR_API_BASE_URL", "Calendar API base URL")],
            workflows=["Appointment sync", "Conflict checks", "Provider availability"],
            action="Connect calendar API and validate appointment create/update/cancel sync.",
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
        ),
        IntegrationSpec(
            key="copilotkit",
            health_key="copilotkit",
            label="CopilotKit runtime",
            env_values={"COPILOTKIT_RUNTIME_URL": settings.copilotkit_runtime_url},
            fields=[IntegrationField("COPILOTKIT_RUNTIME_URL", "Runtime URL")],
            workflows=["Assistant runtime", "Tool policy", "Confirmation gates"],
            action="Deploy runtime and approve model, tenant, and tool authorization policy.",
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
    ]
    health = [await client.health() for client in clients]
    return {item.name: item.as_dict() for item in health}


def _config_out(spec: IntegrationSpec, organization_id: str, health: dict) -> dict:
    status = health.get(spec.health_key, {})
    draft_configured = _draft_configured(spec, organization_id)
    env_configured = all(value.strip() for value in spec.env_values.values())
    configured = bool(status.get("configured")) or draft_configured
    mode = "environment" if env_configured else "setup_draft" if draft_configured else "demo"
    last_test = _last_tests.get(_test_key(organization_id, spec.key), {})
    return {
        "key": spec.key,
        "label": spec.label,
        "configured": configured,
        "healthy": bool(status.get("ok")),
        "mode": mode,
        "status": _config_status(configured, bool(status.get("ok")), mode),
        "fields": [_field_out(spec, field, organization_id) for field in spec.fields],
        "workflows": spec.workflows,
        "action": spec.action,
        "last_tested_at": last_test.get("last_tested_at"),
        "last_test_status": last_test.get("last_test_status"),
    }


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
