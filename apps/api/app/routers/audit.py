from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_roles
from app.models.user import User, UserRole
from app.schemas.audit import AuditEventListOut, AuditEventOut
from app.services.audit_service import list_events

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=AuditEventListOut)
async def list_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    event_type: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),  # noqa: B008
):
    data, total = await list_events(
        db,
        page=page,
        page_size=page_size,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    return AuditEventListOut(
        data=[AuditEventOut.model_validate(event) for event in data],
        total=total,
        page=page,
        page_size=page_size,
    )
