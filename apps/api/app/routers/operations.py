from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_roles
from app.models.user import User, UserRole
from app.schemas.operations import (
    BrowserQaChecklistOut,
    BrowserQaSessionListOut,
    BrowserQaSessionOut,
    BrowserQaSessionStart,
    BrowserQaSessionUpdate,
    AdapterImplementationPacketOut,
    CredentialBinderSnapshotListOut,
    CredentialBinderSnapshotOut,
    CredentialDryRunBinderOut,
    CutoverRunbookOut,
    CutoverRunbookSessionListOut,
    CutoverRunbookSessionOut,
    CutoverRunbookSessionStart,
    CutoverRunbookSessionUpdate,
    DocumentStorageReadinessOut,
    GoLivePacketOut,
    GoLiveAttestationCreate,
    GoLiveAttestationListOut,
    GoLiveAttestationOut,
    IntegrationCutoverReadinessPacketOut,
    OperationsAlertRuleListOut,
    OperationsAlertRuleOut,
    OperationsIncidentTimelineOut,
    LiveUseRehearsalOut,
    OperatorHealthOut,
    OperationsIncidentListOut,
    OperationsIncidentOut,
    OperationsTimelineItemOut,
    PolicyApprovalChecklistOut,
    PolicyApprovalSessionListOut,
    PolicyApprovalSessionOut,
    PolicyApprovalSessionStart,
    PolicyApprovalSessionUpdate,
    ProductionConfigAuditOut,
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
    RestoreDrillChecklistOut,
    RestoreDrillSessionListOut,
    RestoreDrillSessionOut,
    RestoreDrillSessionStart,
    RestoreDrillSessionUpdate,
    RoleDryRunChecklistListOut,
    RoleDryRunSessionListOut,
    RoleDryRunSessionOut,
    RoleDryRunSessionStart,
    RoleDryRunSessionUpdate,
    StaffTrainingChecklistOut,
    StaffTrainingSessionListOut,
    StaffTrainingSessionOut,
    StaffTrainingSessionStart,
    StaffTrainingSessionUpdate,
    VendorCredentialRequestPacketOut,
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


@router.get("/incident-timeline", response_model=OperationsIncidentTimelineOut)
async def get_incident_timeline(db: DbDep, current_user: OpsUserDep):
    result = await operations_service.incident_timeline(db, current_user)
    return OperationsIncidentTimelineOut(
        data=[OperationsTimelineItemOut(**item) for item in result["data"]],
        total=result["total"],
        critical_count=result["critical_count"],
        warning_count=result["warning_count"],
        generated_at=result["generated_at"],
    )


@router.get("/alert-rules", response_model=OperationsAlertRuleListOut)
async def get_alert_rules(db: DbDep, current_user: OpsUserDep):
    result = await operations_service.alert_rules(db, current_user)
    return OperationsAlertRuleListOut(
        data=[OperationsAlertRuleOut(**item) for item in result["data"]],
        total=result["total"],
        triggered_count=result["triggered_count"],
        critical_count=result["critical_count"],
        warning_count=result["warning_count"],
        generated_at=result["generated_at"],
    )


@router.get("/document-storage-readiness", response_model=DocumentStorageReadinessOut)
async def get_document_storage_readiness(db: DbDep, current_user: OpsUserDep):
    return DocumentStorageReadinessOut(
        **await operations_service.document_storage_readiness(db, current_user)
    )


@router.get("/production-config-audit", response_model=ProductionConfigAuditOut)
async def get_production_config_audit(current_user: OpsUserDep):
    return ProductionConfigAuditOut(
        **operations_service.production_config_audit()
    )


@router.get("/browser-qa-checklist", response_model=BrowserQaChecklistOut)
async def get_browser_qa_checklist(current_user: OpsUserDep):
    return BrowserQaChecklistOut(
        **operations_service.browser_qa_checklist()
    )


@router.post(
    "/browser-qa-sessions",
    response_model=BrowserQaSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_browser_qa_session(data: BrowserQaSessionStart, db: DbDep, current_user: OpsUserDep):
    return BrowserQaSessionOut(
        **await operations_service.start_browser_qa_session(db, current_user, data.model_dump())
    )


@router.get("/browser-qa-sessions", response_model=BrowserQaSessionListOut)
async def list_browser_qa_sessions(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_browser_qa_sessions(db, current_user)
    return BrowserQaSessionListOut(
        data=[BrowserQaSessionOut(**item) for item in rows],
        total=total,
    )


@router.patch("/browser-qa-sessions/{session_id}", response_model=BrowserQaSessionOut)
async def update_browser_qa_session(
    session_id: str,
    data: BrowserQaSessionUpdate,
    db: DbDep,
    current_user: OpsUserDep,
):
    session = await operations_service.update_browser_qa_session(
        db,
        current_user,
        session_id,
        data.model_dump(),
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Browser QA session not found")
    return BrowserQaSessionOut(**session)


@router.get("/staff-training-checklist", response_model=StaffTrainingChecklistOut)
async def get_staff_training_checklist(current_user: OpsUserDep):
    return StaffTrainingChecklistOut(
        **operations_service.staff_training_checklist()
    )


@router.post(
    "/staff-training-sessions",
    response_model=StaffTrainingSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_staff_training_session(data: StaffTrainingSessionStart, db: DbDep, current_user: OpsUserDep):
    return StaffTrainingSessionOut(
        **await operations_service.start_staff_training_session(db, current_user, data.model_dump())
    )


@router.get("/staff-training-sessions", response_model=StaffTrainingSessionListOut)
async def list_staff_training_sessions(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_staff_training_sessions(db, current_user)
    return StaffTrainingSessionListOut(
        data=[StaffTrainingSessionOut(**item) for item in rows],
        total=total,
    )


@router.patch("/staff-training-sessions/{session_id}", response_model=StaffTrainingSessionOut)
async def update_staff_training_session(
    session_id: str,
    data: StaffTrainingSessionUpdate,
    db: DbDep,
    current_user: OpsUserDep,
):
    session = await operations_service.update_staff_training_session(
        db,
        current_user,
        session_id,
        data.model_dump(),
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff training session not found")
    return StaffTrainingSessionOut(**session)


@router.get("/policy-approval-checklist", response_model=PolicyApprovalChecklistOut)
async def get_policy_approval_checklist(current_user: OpsUserDep):
    return PolicyApprovalChecklistOut(
        **operations_service.policy_approval_checklist()
    )


@router.post(
    "/policy-approval-sessions",
    response_model=PolicyApprovalSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_policy_approval_session(data: PolicyApprovalSessionStart, db: DbDep, current_user: OpsUserDep):
    return PolicyApprovalSessionOut(
        **await operations_service.start_policy_approval_session(db, current_user, data.model_dump())
    )


@router.get("/policy-approval-sessions", response_model=PolicyApprovalSessionListOut)
async def list_policy_approval_sessions(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_policy_approval_sessions(db, current_user)
    return PolicyApprovalSessionListOut(
        data=[PolicyApprovalSessionOut(**item) for item in rows],
        total=total,
    )


@router.patch("/policy-approval-sessions/{session_id}", response_model=PolicyApprovalSessionOut)
async def update_policy_approval_session(
    session_id: str,
    data: PolicyApprovalSessionUpdate,
    db: DbDep,
    current_user: OpsUserDep,
):
    session = await operations_service.update_policy_approval_session(
        db,
        current_user,
        session_id,
        data.model_dump(),
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy approval session not found")
    return PolicyApprovalSessionOut(**session)


@router.get("/cutover-runbook", response_model=CutoverRunbookOut)
async def get_cutover_runbook(current_user: OpsUserDep):
    return CutoverRunbookOut(
        **operations_service.cutover_runbook()
    )


@router.post(
    "/cutover-runbook-sessions",
    response_model=CutoverRunbookSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_cutover_runbook_session(data: CutoverRunbookSessionStart, db: DbDep, current_user: OpsUserDep):
    return CutoverRunbookSessionOut(
        **await operations_service.start_cutover_runbook_session(db, current_user, data.model_dump())
    )


@router.get("/cutover-runbook-sessions", response_model=CutoverRunbookSessionListOut)
async def list_cutover_runbook_sessions(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_cutover_runbook_sessions(db, current_user)
    return CutoverRunbookSessionListOut(
        data=[CutoverRunbookSessionOut(**item) for item in rows],
        total=total,
    )


@router.patch("/cutover-runbook-sessions/{session_id}", response_model=CutoverRunbookSessionOut)
async def update_cutover_runbook_session(
    session_id: str,
    data: CutoverRunbookSessionUpdate,
    db: DbDep,
    current_user: OpsUserDep,
):
    session = await operations_service.update_cutover_runbook_session(
        db,
        current_user,
        session_id,
        data.model_dump(),
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cutover runbook session not found")
    return CutoverRunbookSessionOut(**session)


@router.get("/cutover-runbook-sessions/{session_id}/export")
async def export_cutover_runbook_session(session_id: str, db: DbDep, current_user: OpsUserDep):
    session = await operations_service.get_cutover_runbook_session(db, current_user, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cutover runbook session not found")
    return Response(
        content=operations_service.cutover_runbook_csv(session),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="concierge-os-cutover-runbook.csv"'},
    )


@router.get("/launch-workplan", response_model=LaunchWorkplanOut)
async def get_launch_workplan(db: DbDep, current_user: OpsUserDep):
    return LaunchWorkplanOut(
        **await operations_service.launch_workplan(db, current_user)
    )


@router.get("/credential-dry-run-binder", response_model=CredentialDryRunBinderOut)
async def get_credential_dry_run_binder(db: DbDep, current_user: OpsUserDep):
    return CredentialDryRunBinderOut(
        **await operations_service.credential_dry_run_binder(db, current_user)
    )


@router.get("/credential-dry-run-binder/export")
async def export_credential_dry_run_binder(db: DbDep, current_user: OpsUserDep):
    binder = await operations_service.credential_dry_run_binder(db, current_user)
    return Response(
        content=operations_service.credential_dry_run_binder_csv(binder),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{binder["export_filename"]}"'},
    )


@router.get("/vendor-credential-request-packet", response_model=VendorCredentialRequestPacketOut)
async def get_vendor_credential_request_packet(db: DbDep, current_user: OpsUserDep):
    return VendorCredentialRequestPacketOut(
        **await operations_service.vendor_credential_request_packet(db, current_user)
    )


@router.get("/vendor-credential-request-packet/export")
async def export_vendor_credential_request_packet(db: DbDep, current_user: OpsUserDep):
    packet = await operations_service.vendor_credential_request_packet(db, current_user)
    return Response(
        content=operations_service.vendor_credential_request_packet_csv(packet),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{packet["export_filename"]}"'},
    )


@router.get("/adapter-implementation-packet", response_model=AdapterImplementationPacketOut)
async def get_adapter_implementation_packet(db: DbDep, current_user: OpsUserDep):
    return AdapterImplementationPacketOut(
        **await operations_service.adapter_implementation_packet(db, current_user)
    )


@router.get("/adapter-implementation-packet/export")
async def export_adapter_implementation_packet(db: DbDep, current_user: OpsUserDep):
    packet = await operations_service.adapter_implementation_packet(db, current_user)
    return Response(
        content=operations_service.adapter_implementation_packet_csv(packet),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{packet["export_filename"]}"'},
    )


@router.get("/integration-cutover-readiness-packet", response_model=IntegrationCutoverReadinessPacketOut)
async def get_integration_cutover_readiness_packet(db: DbDep, current_user: OpsUserDep):
    return IntegrationCutoverReadinessPacketOut(
        **await operations_service.integration_cutover_readiness_packet(db, current_user)
    )


@router.get("/integration-cutover-readiness-packet/export")
async def export_integration_cutover_readiness_packet(db: DbDep, current_user: OpsUserDep):
    packet = await operations_service.integration_cutover_readiness_packet(db, current_user)
    return Response(
        content=operations_service.integration_cutover_readiness_packet_csv(packet),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{packet["export_filename"]}"'},
    )


@router.post(
    "/integration-cutover-readiness-packet/{integration}/assignment",
    response_model=RehearsalActionAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def assign_integration_cutover_lane(
    integration: str,
    data: RehearsalActionAssignmentUpdate,
    db: DbDep,
    current_user: OpsUserDep,
):
    assignment = await operations_service.assign_integration_cutover_lane(
        db,
        current_user,
        integration,
        data.model_dump(),
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration cutover lane not found")
    return RehearsalActionAssignmentOut(**assignment)


@router.post(
    "/credential-dry-run-binder/snapshots",
    response_model=CredentialBinderSnapshotOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_credential_dry_run_binder_snapshot(db: DbDep, current_user: OpsUserDep):
    return CredentialBinderSnapshotOut(
        **await operations_service.create_credential_binder_snapshot(db, current_user)
    )


@router.get("/credential-dry-run-binder/snapshots", response_model=CredentialBinderSnapshotListOut)
async def list_credential_dry_run_binder_snapshots(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_credential_binder_snapshots(db, current_user)
    return CredentialBinderSnapshotListOut(
        data=[CredentialBinderSnapshotOut(**item) for item in rows],
        total=total,
    )


@router.get("/go-live-packet", response_model=GoLivePacketOut)
async def get_go_live_packet(db: DbDep, current_user: OpsUserDep):
    return GoLivePacketOut(
        **await operations_service.go_live_packet(db, current_user)
    )


@router.get("/live-use-rehearsal", response_model=LiveUseRehearsalOut)
async def get_live_use_rehearsal(db: DbDep, current_user: OpsUserDep):
    return LiveUseRehearsalOut(
        **await operations_service.live_use_rehearsal(db, current_user)
    )


@router.get("/live-use-rehearsal/export")
async def export_live_use_rehearsal(db: DbDep, current_user: OpsUserDep):
    dashboard = await operations_service.live_use_rehearsal(db, current_user)
    return Response(
        content=operations_service.live_use_rehearsal_csv(dashboard),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="concierge-os-live-use-rehearsal.csv"'},
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
    try:
        attestation = await operations_service.attest_go_live_packet(db, current_user, data.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GoLiveAttestationOut(
        **attestation
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


@router.get("/restore-drill-checklist", response_model=RestoreDrillChecklistOut)
async def get_restore_drill_checklist(current_user: OpsUserDep):
    return RestoreDrillChecklistOut(**operations_service.restore_drill_checklist())


@router.post(
    "/restore-drill-sessions",
    response_model=RestoreDrillSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_restore_drill_session(data: RestoreDrillSessionStart, db: DbDep, current_user: OpsUserDep):
    return RestoreDrillSessionOut(
        **await operations_service.start_restore_drill_session(db, current_user, data.model_dump())
    )


@router.get("/restore-drill-sessions", response_model=RestoreDrillSessionListOut)
async def list_restore_drill_sessions(db: DbDep, current_user: OpsUserDep):
    rows, total = await operations_service.list_restore_drill_sessions(db, current_user)
    return RestoreDrillSessionListOut(data=[RestoreDrillSessionOut(**item) for item in rows], total=total)


@router.patch("/restore-drill-sessions/{session_id}", response_model=RestoreDrillSessionOut)
async def update_restore_drill_session(
    session_id: str,
    data: RestoreDrillSessionUpdate,
    db: DbDep,
    current_user: OpsUserDep,
):
    session = await operations_service.update_restore_drill_session(
        db,
        current_user,
        session_id,
        data.model_dump(exclude_none=True),
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restore drill session not found")
    return RestoreDrillSessionOut(**session)


@router.get("/restore-drill-sessions/{session_id}/export")
async def export_restore_drill_session(session_id: str, db: DbDep, current_user: OpsUserDep):
    session = await operations_service.get_restore_drill_session(db, current_user, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restore drill session not found")
    return Response(
        content=operations_service.restore_drill_session_csv(session),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="concierge-os-restore-drill.csv"'},
    )
