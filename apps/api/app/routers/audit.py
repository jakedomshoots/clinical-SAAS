import csv
import io
import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_roles
from app.models.user import User, UserRole
from app.schemas.audit import (
    AuditEventListOut,
    AuditEventOut,
    AuditReviewSummaryOut,
    PatientAccessHistoryOut,
)
from app.services.audit_service import (
    list_events,
    list_events_for_export,
    log_event,
    patient_access_history,
    review_summary,
)
from app.services.csv_safety import neutralize_csv_formula

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/review-summary", response_model=AuditReviewSummaryOut)
async def get_audit_review_summary(
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),  # noqa: B008
):
    return AuditReviewSummaryOut(**await review_summary(db, current_user))


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
        current_user,
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


@router.get("/export")
async def export_audit_events(
    event_type: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    limit: int = Query(10_000, ge=1, le=50_000),
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),  # noqa: B008
):
    events = await list_events_for_export(
        db,
        current_user,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
    )
    await log_event(
        db,
        "audit.exported",
        "audit",
        current_user.organization_id,
        actor_id=current_user.id,
        payload={
            "filters": {
                "event_type": event_type,
                "entity_type": entity_type,
                "entity_id": entity_id,
            },
            "limit": limit,
            "row_count": len(events),
        },
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "id",
        "organization_id",
        "created_at",
        "actor_id",
        "event_type",
        "entity_type",
        "entity_id",
        "payload",
    ])
    for event in events:
        writer.writerow([
            neutralize_csv_formula(event.id),
            neutralize_csv_formula(event.organization_id),
            neutralize_csv_formula(event.created_at.isoformat()),
            neutralize_csv_formula(event.actor_id or ""),
            neutralize_csv_formula(event.event_type),
            neutralize_csv_formula(event.entity_type),
            neutralize_csv_formula(event.entity_id),
            neutralize_csv_formula(json.dumps(event.payload or {}, sort_keys=True)),
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="concierge-os-audit.csv"'},
    )


@router.get("/patients/{patient_id}/access-history", response_model=PatientAccessHistoryOut)
async def get_patient_access_history(
    patient_id: str,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),  # noqa: B008
):
    data, total = await patient_access_history(db, current_user, patient_id)
    return PatientAccessHistoryOut(
        data=[AuditEventOut.model_validate(event) for event in data],
        total=total,
    )
