import secrets
import hashlib
import hmac
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.webhook import WebhookIn, WebhookOut
from app.services import task_service
from app.services.integration_event_service import find_by_idempotency_key, record_event

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

INTEGRATION_BY_SOURCE = {
    "ehr": "ehr",
    "fax": "fax_provider",
    "portal": "portal",
    "calendar": "calendar",
    "communications": "communications",
}


def _verify_webhook_secret(
    secret: str | None,
    timestamp: str | None,
    signature: str | None,
    body: bytes,
) -> None:
    expected = settings.webhook_shared_secret.strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook authentication is not configured",
        )
    if not secret or not secrets.compare_digest(secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )
    try:
        occurred_at = datetime.fromtimestamp(int(timestamp or ""), tz=UTC)
    except (TypeError, ValueError, OSError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook timestamp",
        ) from None
    age = abs((datetime.now(UTC) - occurred_at).total_seconds())
    if age > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook timestamp is outside the allowed replay window",
        )
    expected_signature = hmac.new(
        expected.encode("utf-8"),
        timestamp.encode("utf-8") + b"." + body,
        hashlib.sha256,
    ).hexdigest()
    expected_header = f"sha256={expected_signature}"
    if not signature or not secrets.compare_digest(signature, expected_header):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )


async def _receive_webhook(
    source: str,
    data: WebhookIn,
    db: AsyncSession,
    secret: str | None,
    timestamp: str | None,
    signature: str | None,
    body: bytes,
) -> WebhookOut:
    _verify_webhook_secret(secret, timestamp, signature, body)
    integration = INTEGRATION_BY_SOURCE[source]
    if not data.event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook event_id is required for idempotency",
        )
    idempotency_key = data.event_id
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
    request: Request,
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
    timestamp: str | None = Header(default=None, alias="X-Concierge-Webhook-Timestamp"),
    signature: str | None = Header(default=None, alias="X-Concierge-Webhook-Signature"),
):
    return await _receive_webhook("fax", data, db, secret, timestamp, signature, await request.body())


@router.post("/portal", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_portal_webhook(
    request: Request,
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
    timestamp: str | None = Header(default=None, alias="X-Concierge-Webhook-Timestamp"),
    signature: str | None = Header(default=None, alias="X-Concierge-Webhook-Signature"),
):
    return await _receive_webhook("portal", data, db, secret, timestamp, signature, await request.body())


@router.post("/calendar", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_calendar_webhook(
    request: Request,
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
    timestamp: str | None = Header(default=None, alias="X-Concierge-Webhook-Timestamp"),
    signature: str | None = Header(default=None, alias="X-Concierge-Webhook-Signature"),
):
    return await _receive_webhook("calendar", data, db, secret, timestamp, signature, await request.body())


@router.post("/ehr", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_ehr_webhook(
    request: Request,
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
    timestamp: str | None = Header(default=None, alias="X-Concierge-Webhook-Timestamp"),
    signature: str | None = Header(default=None, alias="X-Concierge-Webhook-Signature"),
):
    return await _receive_webhook("ehr", data, db, secret, timestamp, signature, await request.body())


@router.post("/communications", response_model=WebhookOut, status_code=status.HTTP_202_ACCEPTED)
async def receive_communications_webhook(
    request: Request,
    data: WebhookIn,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    secret: str | None = Header(default=None, alias="X-Concierge-Webhook-Secret"),
    timestamp: str | None = Header(default=None, alias="X-Concierge-Webhook-Timestamp"),
    signature: str | None = Header(default=None, alias="X-Concierge-Webhook-Signature"),
):
    return await _receive_webhook("communications", data, db, secret, timestamp, signature, await request.body())
