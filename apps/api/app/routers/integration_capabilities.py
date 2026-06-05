from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api/integration-capabilities", tags=["integration-capabilities"])


@router.get("")
async def capabilities():
    return {
        "ehr": {"configured": bool(settings.ehr_api_base_url), "env_vars": ["EHR_API_BASE_URL"], "supports": ["demographics", "medications", "labs", "encounters", "fhir_placeholder"]},
        "portal": {"configured": bool(settings.portal_api_base_url), "env_vars": ["PORTAL_API_BASE_URL"], "supports": ["messages", "intake", "appointment_requests"]},
        "fax": {"configured": bool(settings.fax_provider_api_key), "env_vars": ["FAX_PROVIDER_API_KEY"], "supports": ["inbound", "outbound", "document_matching"]},
        "calendar": {"configured": bool(settings.calendar_api_base_url), "env_vars": ["CALENDAR_API_BASE_URL"], "supports": ["appointment_create", "appointment_update"]},
        "communications": {"configured": bool(settings.communications_provider_api_key), "env_vars": ["COMMUNICATIONS_PROVIDER", "COMMUNICATIONS_PROVIDER_API_KEY"], "supports": ["sms", "email", "delivery_callbacks"]},
    }
