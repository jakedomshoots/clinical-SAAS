from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_roles
from app.models.user import User, UserRole
from app.schemas.operations import (
    GoLivePacketOut,
    GoLiveAttestationCreate,
    GoLiveAttestationListOut,
    GoLiveAttestationOut,
    OperatorHealthOut,
    OperationsIncidentListOut,
    OperationsIncidentOut,
    LaunchWorkplanOut,
    LaunchWorkplanSnapshotListOut,
    LaunchWorkplanSnapshotOut,
    ProductionRehearsalReportOut,
    ProductionRehearsalSnapshotListOut,
    ProductionRehearsalSnapshotOut,
    ReadinessSnapshotListOut,
    ReadinessSnapshotOut,
    RehearsalActionAssignmentOut,
    RehearsalActionAssignmentUpdate,
    RoleDryRunChecklistListOut,
    RoleDryRunSessionListOut,
    RoleDryRunSessionOut,
    RoleDryRunSessionStart,
    RoleDryRunSessionUpdate,
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


@router.get("/operator-health", response_model=OperatorHealthOut)
async def get_operator_health(db: DbDep, current_user: OpsUserDep):
    return OperatorHealthOut(
        **await operations_service.operator_health(db, current_user)
    )


@router.get("/launch-workplan", response_model=LaunchWorkplanOut)
async def get_launch_workplan(db: DbDep, current_user: OpsUserDep):
    return LaunchWorkplanOut(
        **await operations_service.launch_workplan(db, current_user)
    )


@router.get("/go-live-packet", response_model=GoLivePacketOut)
async def get_go_live_packet(db: DbDep, current_user: OpsUserDep):
    return GoLivePacketOut(
        **await operations_service.go_live_packet(db, current_user)
    )


@router.get("/role-dry-run-checklists", response_model=RoleDryRunChecklistListOut)
async def get_role_dry_run_checklists(db: DbDep, current_user: OpsUserDep):
    return RoleDryRunChecklistListOut(
        **await operations_service.role_dry_run_checklists(db, current_user)
    )


@router.post(
    "/role-dry-run-sessions",
    response_model=RoleDryRunSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_role_dry_run_session(data: RoleDryRunSessionStart, db: DbDep, current_user: OpsUserDep):
    return RoleDryRunSessionOut(
        **await operations_service.start_role_dry_run_session(db, current_user, data.model_dump())
    )


@router.get("/role-dry-run-sessions", response_model=RoleDryRunSessionListOut)
async def list_role_dry_run_sessions(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_role_dry_run_sessions(db, current_user)
    return RoleDryRunSessionListOut(
        data=[RoleDryRunSessionOut(**item) for item in rows],
        total=total,
    )


@router.patch("/role-dry-run-sessions/{session_id}", response_model=RoleDryRunSessionOut)
async def update_role_dry_run_session(
    session_id: str,
    data: RoleDryRunSessionUpdate,
    db: DbDep,
    current_user: OpsUserDep,
):
    session = await operations_service.update_role_dry_run_session(
        db,
        current_user,
        session_id,
        data.model_dump(),
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role dry-run session not found")
    return RoleDryRunSessionOut(**session)


@router.post(
    "/go-live-packet/attestations",
    response_model=GoLiveAttestationOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_go_live_attestation(data: GoLiveAttestationCreate, db: DbDep, current_user: OpsUserDep):
    return GoLiveAttestationOut(
        **await operations_service.attest_go_live_packet(db, current_user, data.model_dump())
    )


@router.get("/go-live-packet/attestations", response_model=GoLiveAttestationListOut)
async def list_go_live_attestations(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_go_live_attestations(db, current_user)
    return GoLiveAttestationListOut(
        data=[GoLiveAttestationOut(**item) for item in rows],
        total=total,
    )


@router.post(
    "/launch-workplan/snapshots",
    response_model=LaunchWorkplanSnapshotOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_launch_workplan_snapshot(db: DbDep, current_user: OpsUserDep):
    return LaunchWorkplanSnapshotOut(
        **await operations_service.create_launch_workplan_snapshot(db, current_user)
    )


@router.get("/launch-workplan/snapshots", response_model=LaunchWorkplanSnapshotListOut)
async def list_launch_workplan_snapshots(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_launch_workplan_snapshots(db, current_user)
    return LaunchWorkplanSnapshotListOut(
        data=[LaunchWorkplanSnapshotOut(**item) for item in rows],
        total=total,
    )


@router.get("/launch-workplan/export")
async def export_launch_workplan(db: DbDep, current_user: OpsUserDep):
    workplan = await operations_service.launch_workplan(db, current_user)
    return Response(
        content=operations_service.launch_workplan_csv(workplan),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="concierge-os-launch-workplan.csv"'},
    )


@router.get("/production-rehearsal", response_model=ProductionRehearsalReportOut)
async def get_production_rehearsal_report(db: DbDep, current_user: OpsUserDep):
    return ProductionRehearsalReportOut(
        **await operations_service.production_rehearsal_report(db, current_user)
    )


@router.post(
    "/production-rehearsal/snapshots",
    response_model=ProductionRehearsalSnapshotOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_production_rehearsal_snapshot(db: DbDep, current_user: OpsUserDep):
    return ProductionRehearsalSnapshotOut(
        **await operations_service.create_rehearsal_snapshot(db, current_user)
    )


@router.get(
    "/production-rehearsal/snapshots",
    response_model=ProductionRehearsalSnapshotListOut,
)
async def list_production_rehearsal_snapshots(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_rehearsal_snapshots(db, current_user)
    return ProductionRehearsalSnapshotListOut(
        data=[ProductionRehearsalSnapshotOut(**item) for item in rows],
        total=total,
    )


@router.get("/production-rehearsal/export")
async def export_production_rehearsal_report(db: DbDep, current_user: OpsUserDep):
    report = await operations_service.production_rehearsal_report(db, current_user)
    return Response(
        content=operations_service.rehearsal_report_csv(report),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="concierge-os-production-rehearsal.csv"'},
    )


@router.post(
    "/production-rehearsal/actions/{action_key}/assignment",
    response_model=RehearsalActionAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def assign_production_rehearsal_action(
    action_key: str,
    data: RehearsalActionAssignmentUpdate,
    db: DbDep,
    current_user: OpsUserDep,
):
    assignment = await operations_service.assign_rehearsal_action(
        db,
        current_user,
        action_key,
        data.model_dump(),
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rehearsal action is not currently open")
    return RehearsalActionAssignmentOut(**assignment)


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
