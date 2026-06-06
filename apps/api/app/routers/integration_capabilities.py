from fastapi import APIRouter

from app.config import settings
from app.services.readiness_service import check_external_integrations

router = APIRouter(prefix="/api/integration-capabilities", tags=["integration-capabilities"])


@router.get("")
async def capabilities():
    health = await check_external_integrations()
    return {
        "ehr": _capability(
            health,
            "ehr",
            label="EHR",
            env_vars=["EHR_API_BASE_URL"],
            supports=["demographics", "medications", "labs", "encounters", "fhir_placeholder"],
            workflows=["Chart sync", "Medication reconciliation", "Lab import"],
            action="Choose an EHR adapter and set EHR_API_BASE_URL.",
        ),
        "portal": _capability(
            health,
            "portal",
            label="Patient portal",
            env_vars=["PORTAL_API_BASE_URL"],
            supports=["messages", "intake", "appointment_requests", "document_import"],
            workflows=["Portal messages", "Patient intake", "Outside document routing"],
            action="Connect the external portal endpoint and map inbound webhook payloads.",
        ),
        "fax": _capability(
            health,
            "fax_provider",
            label="Fax provider",
            env_vars=["FAX_PROVIDER_API_KEY"],
            supports=["inbound", "outbound", "document_matching"],
            workflows=["Inbound fax matching", "Outbound referrals", "Document queue"],
            action="Set FAX_PROVIDER_API_KEY and verify inbound/outbound callback delivery.",
        ),
        "calendar": _capability(
            health,
            "calendar",
            label="Calendar",
            env_vars=["CALENDAR_API_BASE_URL"],
            supports=["appointment_create", "appointment_update", "conflict_sync"],
            workflows=["Schedule sync", "Conflict checks", "Reminder source of truth"],
            action="Set CALENDAR_API_BASE_URL and verify appointment create/update sync.",
        ),
        "communications": _capability(
            health,
            "communications",
            label="Communications",
            env_vars=["COMMUNICATIONS_PROVIDER", "COMMUNICATIONS_PROVIDER_API_KEY"],
            supports=["sms", "email", "delivery_callbacks"],
            workflows=["Patient outreach", "Appointment reminders", "Delivery tracking"],
            action="Select the delivery provider and configure callback secrets.",
        ),
        "copilotkit": _capability(
            health,
            "copilotkit",
            label="CopilotKit runtime",
            env_vars=["COPILOTKIT_RUNTIME_URL"],
            supports=["assistant_runtime", "tool_policy", "confirmation_gates"],
            workflows=["Clinical assistant", "Tool execution", "Review queue"],
            action="Deploy the runtime and approve model/tool policy before live use.",
        ),
        "clearinghouse": _capability(
            health,
            "clearinghouse",
            label="Clearinghouse",
            env_vars=["CLEARINGHOUSE_API_BASE_URL", "CLEARINGHOUSE_API_KEY"],
            supports=["claim_submission", "eligibility", "denials", "era_remittance"],
            workflows=["Claim submission", "Denial callbacks", "ERA/remittance import"],
            action="Connect clearinghouse credentials and validate claim, denial, and remittance workflows.",
        ),
    }


def _capability(
    health: dict,
    key: str,
    *,
    label: str,
    env_vars: list[str],
    supports: list[str],
    workflows: list[str],
    action: str,
) -> dict:
    status = health.get(key, {})
    return {
        "label": label,
        "configured": bool(status.get("configured")),
        "healthy": bool(status.get("ok")),
        "mode": status.get("mode", "unknown"),
        "env_vars": env_vars,
        "supports": supports,
        "workflows": workflows,
        "action": action,
        "error": status.get("error"),
    }
