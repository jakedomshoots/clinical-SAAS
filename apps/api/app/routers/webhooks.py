from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.webhook import WebhookIn, WebhookOut
from app.services import task_service
from app.services.integration_event_service import find_by_idempotency_key, record_event

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

INTEGRATION_BY_SOURCE = {
    "ehr": "ehr",
    "fax": "fax_provider",
    "portal": "portal",
    "calendar": "calendar",
    "communications": "communications",
}


def _verify_webhook_secret(secret: str | None) -> None:
    expected = settings.webhook_shared_secret.strip()
    if not expected:
        return
    if secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )


async def _receive_webhook(
    source: str,
    data: WebhookIn,
    db: AsyncSession,
    secret: str | None,
) -> WebhookOut:
    _verify_webhook_secret(secret)
    integration = INTEGRATION_BY_SOURCE[source]
    idempotency_key = data.event_id or f"{source}:{data.action}:{data.entity_id or 'none'}"
    existing = await find_by_idempotency_key(db, data.organization_id, idempotency_key)
    if existing:
        return WebhookOut(
            id=existing.id,
            integration=existing.integration,
            status=existing.status.value,
            duplicate=True,
        )

    system_user = User(
        id="webhook",
        email="webhook@concierge.local",
        hashed_password="",
        display_name="Webhook",
        role=UserRole.admin,
        organization_id=data.organization_id,
        is_active=True,
    )
    event = await record_event(
        db,
        system_user,
        integration=integration,
        direction="inbound",
        action=data.action,
        status="succeeded",
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        idempotency_key=idempotency_key,
        payload=data.payload,
    )
    applied = False
    if source == "communications":
        provider_message_id = data.payload.get("provider_message_id")
        delivery_status = data.payload.get("delivery_status")
        if provider_message_id and delivery_status:
            applied = await task_service.apply_delivery_callback(
                db,
                organization_id=data.organization_id,
                provider_message_id=str(provider_message_id),
                status=str(delivery_status),
                error=data.payload.get("error"),
            )
    return WebhookOut(id=event.id, integration=event.integration, status=event.status.value, applied=applied)


@router.post("/fax", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_fax_webhook(
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
):
    return await _receive_webhook("fax", data, db, secret)


@router.post("/portal", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_portal_webhook(
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
):
    return await _receive_webhook("portal", data, db, secret)


@router.post("/calendar", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_calendar_webhook(
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
):
    return await _receive_webhook("calendar", data, db, secret)


@router.post("/ehr", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_ehr_webhook(
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
):
    return await _receive_webhook("ehr", data, db, secret)


@router.post("/communications", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_communications_webhook(
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
):
    return await _receive_webhook("communications", data, db, secret)
