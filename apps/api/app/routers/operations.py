from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_roles
from app.models.user import User, UserRole
from app.schemas.operations import (
    OperationsIncidentListOut,
    OperationsIncidentOut,
    ProductionRehearsalReportOut,
    ReadinessSnapshotListOut,
    ReadinessSnapshotOut,
)
from app.services import operations_service

router = APIRouter(prefix="/api/operations", tags=["operations"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
OpsUserDep = Annotated[User, Depends(require_roles(UserRole.admin, UserRole.manager))]


@router.get("/incidents", response_model=OperationsIncidentListOut)
async def list_operations_incidents(db: DbDep, current_user: OpsUserDep):
    result = await operations_service.incident_register(db, current_user)
    return OperationsIncidentListOut(
        data=[OperationsIncidentOut(**item) for item in result["data"]],
        open_count=result["open_count"],
        critical_count=result["critical_count"],
        warning_count=result["warning_count"],
        generated_at=result["generated_at"],
    )


@router.get("/production-rehearsal", response_model=ProductionRehearsalReportOut)
async def get_production_rehearsal_report(db: DbDep, current_user: OpsUserDep):
    return ProductionRehearsalReportOut(
        **await operations_service.production_rehearsal_report(db, current_user)
    )


@router.post(
    "/readiness-snapshots",
    response_model=ReadinessSnapshotOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_readiness_snapshot(db: DbDep, current_user: OpsUserDep):
    return ReadinessSnapshotOut(
        **await operations_service.create_readiness_snapshot(db, current_user)
    )


@router.get("/readiness-snapshots", response_model=ReadinessSnapshotListOut)
async def list_readiness_snapshots(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_readiness_snapshots(db, current_user)
    return ReadinessSnapshotListOut(
        data=[ReadinessSnapshotOut(**item) for item in rows],
        total=total,
    )
