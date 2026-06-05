from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_roles
from app.models.user import User, UserRole
from app.schemas.integration_event import IntegrationEventListOut, IntegrationEventOut
from app.services import integration_event_service

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
OpsUserDep = Annotated[User, Depends(require_roles(UserRole.admin, UserRole.manager))]


@router.get("/events", response_model=IntegrationEventListOut)
async def list_integration_events(
    db: DbDep,
    current_user: OpsUserDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    integration: str | None = Query(None),
    status: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
):
    data, total = await integration_event_service.list_events(
        db,
        current_user,
        page=page,
        page_size=page_size,
        integration=integration,
        status=status,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    return IntegrationEventListOut(
        data=[IntegrationEventOut.model_validate(item) for item in data],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/events/{event_id}/retry", response_model=IntegrationEventOut)
async def retry_integration_event(event_id: str, db: DbDep, current_user: OpsUserDep):
    event = await integration_event_service.mark_retrying(db, current_user, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration event not found",
        )
    return IntegrationEventOut.model_validate(event)
