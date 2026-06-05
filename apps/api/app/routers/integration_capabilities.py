from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api/integration-capabilities", tags=["integration-capabilities"])


@router.get("")
async def capabilities():
    return {
        "ehr": {"configured": bool(settings.ehr_api_base_url), "supports": ["demographics", "medications", "labs", "encounters", "fhir_placeholder"]},
        "portal": {"configured": bool(settings.portal_api_base_url), "supports": ["messages", "intake", "appointment_requests"]},
        "fax": {"configured": bool(settings.fax_provider_api_key), "supports": ["inbound", "outbound", "document_matching"]},
        "calendar": {"configured": bool(settings.calendar_api_base_url), "supports": ["appointment_create", "appointment_update"]},
        "communications": {"configured": bool(settings.communications_provider_api_key), "supports": ["sms", "email", "delivery_callbacks"]},
    }
