from datetime import datetime

from pydantic import BaseModel, Field


class OperationsIncidentOut(BaseModel):
    key: str
    title: str
    severity: str
    source: str
    status: str
    owner_role: str
    count: int
    detail: str
    recommended_action: str
    route: str


class OperationsIncidentListOut(BaseModel):
    data: list[OperationsIncidentOut]
    open_count: int
    critical_count: int
    warning_count: int
    generated_at: datetime


class OperationsTimelineItemOut(BaseModel):
    key: str
    occurred_at: datetime | str
    severity: str
    category: str
    title: str
    detail: str
    source: str
    route: str
    entity_type: str | None = None
    entity_id: str | None = None


class OperationsIncidentTimelineOut(BaseModel):
    data: list[OperationsTimelineItemOut]
    total: int
    critical_count: int
    warning_count: int
    generated_at: datetime


class OperationsAlertRuleOut(BaseModel):
    key: str
    label: str
    status: str
    severity: str
    count: int
    detail: str
    route: str
    last_triggered_at: datetime | str | None = None


class OperationsAlertRuleListOut(BaseModel):
    data: list[OperationsAlertRuleOut]
    total: int
    triggered_count: int
    critical_count: int
    warning_count: int
    generated_at: datetime


class DocumentStorageReadinessCheckOut(BaseModel):
    key: str
    label: str
    status: str
    severity: str
    count: int
    detail: str
    recommended_action: str
    route: str


class DocumentStorageHandoffOut(BaseModel):
    document_id: str
    patient_id: str | None = None
    occurred_at: datetime | str
    storage_status: str
    presigned: bool
    expires_at: datetime | str | None = None
    expired: bool


class DocumentStorageReadinessOut(BaseModel):
    status: str
    score: int
    generated_at: datetime
    summary: dict[str, int]
    checks: list[DocumentStorageReadinessCheckOut]
    recent_handoffs: list[DocumentStorageHandoffOut]


class OperatorHealthCheckOut(BaseModel):
    key: str
    label: str
    status: str
    score: int
    detail: str
    route: str
    last_seen_at: datetime | str | None = None


class OperatorHealthActionOut(BaseModel):
    key: str
    label: str
    detail: str
    severity: str
    route: str


class OperatorHealthOut(BaseModel):
    status: str
    score: int
    generated_at: datetime
    summary: dict[str, int]
    checks: list[OperatorHealthCheckOut]
    recommended_actions: list[OperatorHealthActionOut]


class ProductionConfigCheckOut(BaseModel):
    key: str
    category: str
    label: str
    ready: bool
    severity: str
    detail: str
    action: str
    env_vars: list[str]
    docs: list[str]


class ProductionConfigAuditOut(BaseModel):
    status: str
    score: int
    environment: str
    generated_at: datetime
    critical_count: int
    warning_count: int
    ready_count: int
    total: int
    checks: list[ProductionConfigCheckOut]


class BrowserQaChecklistItemOut(BaseModel):
    key: str
    label: str
    detail: str
    route: str
    category: str


class BrowserQaChecklistOut(BaseModel):
    generated_at: datetime
    items: list[BrowserQaChecklistItemOut]
    total: int


class BrowserQaSessionStart(BaseModel):
    session_name: str | None = Field(default=None, max_length=120)
    browser: str | None = Field(default=None, max_length=80)
    note: str | None = Field(default=None, max_length=1000)


class BrowserQaSessionUpdate(BaseModel):
    item_key: str | None = None
    qa_status: str | None = Field(default=None, pattern="^(pending|passed|failed)$")
    item_note: str | None = Field(default=None, max_length=1000)
    session_status: str | None = Field(default=None, pattern="^(in_progress|completed)$")
    note: str | None = Field(default=None, max_length=1000)


class BrowserQaSessionItemOut(BrowserQaChecklistItemOut):
    qa_status: str
    note: str | None = None


class BrowserQaSessionOut(BaseModel):
    id: str
    session_id: str
    session_name: str
    browser: str | None = None
    status: str
    note: str | None = None
    started_by: str | None = None
    completed_by: str | None = None
    started_at: datetime | str
    updated_at: datetime
    completed_at: datetime | str | None = None
    item_count: int
    passed_count: int
    failed_count: int
    pending_count: int
    items: list[BrowserQaSessionItemOut]


class BrowserQaSessionListOut(BaseModel):
    data: list[BrowserQaSessionOut]
    total: int


class StaffTrainingChecklistItemOut(BaseModel):
    key: str
    label: str
    detail: str
    route: str
    category: str


class StaffTrainingChecklistRoleOut(BaseModel):
    key: str
    label: str
    summary: str
    items: list[StaffTrainingChecklistItemOut]


class StaffTrainingChecklistOut(BaseModel):
    generated_at: datetime
    roles: list[StaffTrainingChecklistRoleOut]
    total_roles: int
    total_items: int


class StaffTrainingSessionStart(BaseModel):
    session_name: str | None = Field(default=None, max_length=120)
    trainer_name: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=1000)


class StaffTrainingSessionUpdate(BaseModel):
    role_key: str | None = None
    item_key: str | None = None
    training_status: str | None = Field(default=None, pattern="^(pending|reviewed|signed)$")
    item_note: str | None = Field(default=None, max_length=1000)
    session_status: str | None = Field(default=None, pattern="^(in_progress|completed)$")
    note: str | None = Field(default=None, max_length=1000)


class StaffTrainingSessionItemOut(StaffTrainingChecklistItemOut):
    training_status: str
    note: str | None = None


class StaffTrainingSessionRoleOut(BaseModel):
    key: str
    label: str
    summary: str
    items: list[StaffTrainingSessionItemOut]


class StaffTrainingSessionOut(BaseModel):
    id: str
    session_id: str
    session_name: str
    trainer_name: str | None = None
    status: str
    note: str | None = None
    started_by: str | None = None
    completed_by: str | None = None
    started_at: datetime | str
    updated_at: datetime
    completed_at: datetime | str | None = None
    item_count: int
    signed_count: int
    reviewed_count: int
    pending_count: int
    roles: list[StaffTrainingSessionRoleOut]


class StaffTrainingSessionListOut(BaseModel):
    data: list[StaffTrainingSessionOut]
    total: int


class PolicyApprovalChecklistItemOut(BaseModel):
    key: str
    label: str
    detail: str
    route: str
    category: str
    docs: list[str]


class PolicyApprovalChecklistOut(BaseModel):
    generated_at: datetime
    items: list[PolicyApprovalChecklistItemOut]
    total: int


class PolicyApprovalSessionStart(BaseModel):
    session_name: str | None = Field(default=None, max_length=120)
    reviewer_name: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=1000)


class PolicyApprovalSessionUpdate(BaseModel):
    item_key: str | None = None
    approval_status: str | None = Field(default=None, pattern="^(pending|approved|needs_changes)$")
    item_note: str | None = Field(default=None, max_length=1000)
    session_status: str | None = Field(default=None, pattern="^(in_progress|completed)$")
    note: str | None = Field(default=None, max_length=1000)


class PolicyApprovalSessionItemOut(PolicyApprovalChecklistItemOut):
    approval_status: str
    note: str | None = None


class PolicyApprovalSessionOut(BaseModel):
    id: str
    session_id: str
    session_name: str
    reviewer_name: str | None = None
    status: str
    note: str | None = None
    started_by: str | None = None
    completed_by: str | None = None
    started_at: datetime | str
    updated_at: datetime
    completed_at: datetime | str | None = None
    item_count: int
    approved_count: int
    needs_changes_count: int
    pending_count: int
    items: list[PolicyApprovalSessionItemOut]


class PolicyApprovalSessionListOut(BaseModel):
    data: list[PolicyApprovalSessionOut]
    total: int


class CutoverRunbookStepOut(BaseModel):
    key: str
    label: str
    detail: str
    owner_role: str
    expected_minute: int
    rollback_trigger: str | None = None


class CutoverRunbookPhaseOut(BaseModel):
    key: str
    label: str
    objective: str
    steps: list[CutoverRunbookStepOut]


class CutoverRunbookOut(BaseModel):
    generated_at: datetime
    phases: list[CutoverRunbookPhaseOut]
    total_phases: int
    total_steps: int


class CutoverRunbookSessionStart(BaseModel):
    session_name: str | None = Field(default=None, max_length=120)
    cutover_owner: str | None = Field(default=None, max_length=120)
    scheduled_for: datetime | str | None = None
    note: str | None = Field(default=None, max_length=1000)


class CutoverRunbookSessionUpdate(BaseModel):
    phase_key: str | None = None
    step_key: str | None = None
    step_status: str | None = Field(default=None, pattern="^(pending|complete|blocked|rollback)$")
    owner_name: str | None = Field(default=None, max_length=120)
    step_note: str | None = Field(default=None, max_length=1000)
    rollback_status: str | None = Field(default=None, pattern="^(not_reviewed|rollback_ready|rollback_required|not_needed)$")
    rollback_decision: str | None = Field(default=None, max_length=1000)
    session_status: str | None = Field(default=None, pattern="^(in_progress|completed|aborted)$")
    note: str | None = Field(default=None, max_length=1000)


class CutoverRunbookSessionStepOut(CutoverRunbookStepOut):
    step_status: str
    owner_name: str | None = None
    note: str | None = None


class CutoverRunbookSessionPhaseOut(BaseModel):
    key: str
    label: str
    objective: str
    steps: list[CutoverRunbookSessionStepOut]


class CutoverRunbookSessionOut(BaseModel):
    id: str
    session_id: str
    session_name: str
    cutover_owner: str | None = None
    scheduled_for: datetime | str | None = None
    status: str
    rollback_status: str
    rollback_decision: str | None = None
    note: str | None = None
    started_by: str | None = None
    completed_by: str | None = None
    started_at: datetime | str
    updated_at: datetime
    completed_at: datetime | str | None = None
    step_count: int
    complete_count: int
    blocked_count: int
    rollback_count: int
    pending_count: int
    phases: list[CutoverRunbookSessionPhaseOut]


class CutoverRunbookSessionListOut(BaseModel):
    data: list[CutoverRunbookSessionOut]
    total: int


class RestoreDrillChecklistItemOut(BaseModel):
    key: str
    label: str
    detail: str
    route: str
    status: str
    docs: list[str]


class RestoreDrillChecklistOut(BaseModel):
    generated_at: datetime
    items: list[RestoreDrillChecklistItemOut]
    total: int


class RestoreDrillSessionStart(BaseModel):
    session_name: str | None = Field(default=None, max_length=120)
    owner_name: str | None = Field(default=None, max_length=120)
    backup_reference: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=1000)


class RestoreDrillSessionUpdate(BaseModel):
    item_key: str | None = None
    drill_status: str | None = Field(default=None, pattern="^(pending|complete|blocked)$")
    item_note: str | None = Field(default=None, max_length=1000)
    rto_minutes: int | None = Field(default=None, ge=0, le=10080)
    rpo_minutes: int | None = Field(default=None, ge=0, le=10080)
    session_status: str | None = Field(default=None, pattern="^(in_progress|completed)$")
    note: str | None = Field(default=None, max_length=1000)


class RestoreDrillSessionItemOut(RestoreDrillChecklistItemOut):
    drill_status: str
    note: str | None = None


class RestoreDrillSessionOut(BaseModel):
    id: str
    session_id: str
    session_name: str
    owner_name: str | None = None
    backup_reference: str | None = None
    status: str
    note: str | None = None
    started_by: str | None = None
    completed_by: str | None = None
    started_at: datetime | str
    updated_at: datetime
    completed_at: datetime | str | None = None
    rto_minutes: int | None = None
    rpo_minutes: int | None = None
    item_count: int
    complete_count: int
    blocked_count: int
    pending_count: int
    items: list[RestoreDrillSessionItemOut]


class RestoreDrillSessionListOut(BaseModel):
    data: list[RestoreDrillSessionOut]
    total: int


class ReadinessSnapshotOut(BaseModel):
    id: str
    created_at: datetime
    operational_status: str
    core_status: str
    launch_score: int
    incident_count: int
    critical_count: int
    warning_count: int


class ReadinessSnapshotListOut(BaseModel):
    data: list[ReadinessSnapshotOut]
    total: int


class RehearsalGateOut(BaseModel):
    key: str
    label: str
    status: str
    score: int
    detail: str
    route: str


class RehearsalActionAssignmentOut(BaseModel):
    id: str
    action_key: str
    owner_id: str | None = None
    owner_name: str
    status: str
    due_date: str | None = None
    note: str | None = None
    assigned_by: str | None = None
    assigned_at: datetime


class RehearsalActionAssignmentUpdate(BaseModel):
    owner_id: str | None = None
    owner_name: str = Field(min_length=1, max_length=120)
    status: str = Field(default="open", pattern="^(open|in_progress|blocked|done)$")
    due_date: str | None = None
    note: str | None = Field(default=None, max_length=500)


class RehearsalActionOut(BaseModel):
    key: str
    label: str
    detail: str
    route: str
    severity: str
    assignment: RehearsalActionAssignmentOut | None = None


class ProductionRehearsalReportOut(BaseModel):
    status: str
    rehearsal_ready: bool
    score: int
    blocking_count: int
    warning_count: int
    generated_at: datetime
    gates: list[RehearsalGateOut]
    recommended_actions: list[RehearsalActionOut]


class LaunchWorkplanItemOut(BaseModel):
    key: str
    source: str
    category: str
    label: str
    detail: str
    severity: str
    route: str
    owner_role: str
    recommended_action: str
    assignment: RehearsalActionAssignmentOut | None = None


class LaunchWorkplanOut(BaseModel):
    status: str
    generated_at: datetime
    total: int
    blocking_count: int
    warning_count: int
    assigned_count: int
    unassigned_count: int
    unassigned_blocking_count: int
    items: list[LaunchWorkplanItemOut]


class LaunchWorkplanSnapshotOut(BaseModel):
    id: str
    created_at: datetime
    status: str
    total: int
    blocking_count: int
    warning_count: int
    assigned_count: int
    unassigned_count: int
    unassigned_blocking_count: int


class LaunchWorkplanSnapshotListOut(BaseModel):
    data: list[LaunchWorkplanSnapshotOut]
    total: int


class CredentialBinderArchiveOut(BaseModel):
    status: str
    detail: str
    archive_reference_url: str | None = None
    archived_at: datetime | str | None = None


class CredentialBinderItemOut(BaseModel):
    integration: str
    label: str
    status: str
    binder_status: str
    readiness_mode: str
    configured: bool
    healthy: bool
    adapter_implemented: bool
    production_ready: bool
    sandbox_ready: bool
    mode: str
    vendor_profile: dict
    cutover_evidence: dict
    risk_register: dict
    handoff_archive: CredentialBinderArchiveOut
    sandbox_reference_count: int
    sandbox_reference_total: int
    sandbox_evidence_count: int
    missing_steps: list[str]
    blockers: list[str]
    route: str


class CredentialDryRunBinderOut(BaseModel):
    status: str
    generated_at: datetime
    export_filename: str
    ready_count: int
    warning_count: int
    blocking_count: int
    archive_ready_count: int
    vendor_reference_ready_count: int
    total: int
    summary: dict[str, int]
    items: list[CredentialBinderItemOut]


class VendorCredentialRequestArchiveOut(BaseModel):
    status: str
    detail: str
    archive_reference_url: str | None = None
    archived_at: datetime | str | None = None


class VendorCredentialRequestItemOut(BaseModel):
    integration: str
    label: str
    request_status: str
    credential_status: str
    readiness_mode: str
    vendor_profile: dict
    handoff_archive: VendorCredentialRequestArchiveOut
    required_fields: list[str]
    missing_fields: list[str]
    configured_fields: list[str]
    sandbox_reference_count: int
    sandbox_reference_total: int
    blockers: list[str]
    request_checklist: list[str]
    request_subject: str
    request_body: str
    route: str


class VendorCredentialRequestPacketOut(BaseModel):
    status: str
    generated_at: datetime
    export_filename: str
    ready_to_request_count: int
    attention_count: int
    blocked_count: int
    missing_owner_count: int
    missing_contract_count: int
    archive_missing_count: int
    total: int
    summary: dict[str, int]
    items: list[VendorCredentialRequestItemOut]


class AdapterImplementationPhaseOut(BaseModel):
    key: str
    label: str
    status: str
    detail: str


class AdapterImplementationItemOut(BaseModel):
    integration: str
    label: str
    implementation_status: str
    priority: str
    readiness_mode: str
    configured: bool
    adapter_implemented: bool
    adapter_method_ready_count: int
    adapter_method_total: int
    adapter_methods: list[dict]
    required_credentials: list[str]
    missing_credentials: list[str]
    workflows: list[str]
    sandbox_tests: list[str]
    implementation_phases: list[AdapterImplementationPhaseOut]
    blockers: list[str]
    docs: list[str]
    route: str


class AdapterImplementationPacketOut(BaseModel):
    status: str
    generated_at: datetime
    export_filename: str
    implemented_count: int
    placeholder_count: int
    sandbox_only_count: int
    critical_count: int
    high_count: int
    total: int
    summary: dict[str, int]
    items: list[AdapterImplementationItemOut]


class IntegrationCutoverReadinessGateOut(BaseModel):
    key: str
    label: str
    status: str
    detail: str
    route: str


class IntegrationCutoverReadinessItemOut(BaseModel):
    integration: str
    label: str
    cutover_status: str
    go_no_go: str
    readiness_mode: str
    adapter: AdapterImplementationItemOut
    credential_request: VendorCredentialRequestItemOut
    handoff_archive: VendorCredentialRequestArchiveOut
    cutover_evidence: dict
    risk_register: dict
    gates: list[IntegrationCutoverReadinessGateOut]
    blockers: list[str]
    next_actions: list[str]
    route: str
    assignment: RehearsalActionAssignmentOut | None = None


class IntegrationCutoverReadinessPacketOut(BaseModel):
    status: str
    generated_at: datetime
    export_filename: str
    ready_count: int
    attention_count: int
    blocked_count: int
    go_count: int
    hold_count: int
    no_go_count: int
    total: int
    summary: dict[str, int]
    items: list[IntegrationCutoverReadinessItemOut]


class CredentialBinderSnapshotOut(BaseModel):
    id: str
    created_at: datetime
    status: str
    total: int
    ready_count: int
    warning_count: int
    blocking_count: int
    archive_ready_count: int
    vendor_reference_ready_count: int


class CredentialBinderSnapshotListOut(BaseModel):
    data: list[CredentialBinderSnapshotOut]
    total: int


class GoLivePacketEvidenceOut(BaseModel):
    key: str
    label: str
    status: str
    detail: str
    route: str
    captured_at: datetime | str | None = None


class GoLiveAttestationOut(BaseModel):
    id: str
    created_at: datetime
    decision: str
    note: str | None = None
    reviewer_id: str | None = None
    reviewer_name: str | None = None
    packet_status: str
    go_live_ready: bool
    blocking_count: int
    warning_count: int
    evidence_ready_count: int
    evidence_total: int


class GoLiveAttestationCreate(BaseModel):
    decision: str = Field(pattern="^(approved|needs_changes|rejected)$")
    note: str | None = Field(default=None, max_length=1000)


class GoLiveAttestationListOut(BaseModel):
    data: list[GoLiveAttestationOut]
    total: int


class GoLivePacketOut(BaseModel):
    status: str
    go_live_ready: bool
    generated_at: datetime
    environment: str
    core_status: str
    operational_status: str
    launch_score: int
    blocking_count: int
    warning_count: int
    evidence_ready_count: int
    evidence_total: int
    evidence: list[GoLivePacketEvidenceOut]
    open_workplan_items: list[LaunchWorkplanItemOut]
    latest_attestation: GoLiveAttestationOut | None = None


class LiveUseRehearsalGateOut(BaseModel):
    key: str
    label: str
    status: str
    detail: str
    route: str
    captured_at: datetime | str | None = None


class LiveUseRehearsalActionOut(BaseModel):
    key: str
    label: str
    detail: str
    route: str
    severity: str


class LiveUseRehearsalOut(BaseModel):
    status: str
    launch_ready: bool
    score: int
    generated_at: datetime
    summary: dict[str, int]
    gates: list[LiveUseRehearsalGateOut]
    evidence: list[GoLivePacketEvidenceOut]
    next_actions: list[LiveUseRehearsalActionOut]
    open_workplan_items: list[LaunchWorkplanItemOut]


class RoleDryRunChecklistItemOut(BaseModel):
    key: str
    label: str
    detail: str
    route: str
    status: str


class RoleDryRunChecklistOut(BaseModel):
    key: str
    label: str
    summary: str
    status: str
    ready_count: int
    attention_count: int
    total: int
    items: list[RoleDryRunChecklistItemOut]


class RoleDryRunChecklistListOut(BaseModel):
    generated_at: datetime
    roles: list[RoleDryRunChecklistOut]
    total_roles: int
    ready_roles: int
    attention_roles: int


class RoleDryRunSessionStart(BaseModel):
    session_name: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=1000)


class RoleDryRunSessionUpdate(BaseModel):
    role_key: str | None = None
    item_key: str | None = None
    dry_run_status: str | None = Field(default=None, pattern="^(pending|complete|blocked)$")
    item_note: str | None = Field(default=None, max_length=1000)
    session_status: str | None = Field(default=None, pattern="^(in_progress|completed)$")
    note: str | None = Field(default=None, max_length=1000)


class RoleDryRunSessionItemOut(RoleDryRunChecklistItemOut):
    dry_run_status: str
    note: str | None = None


class RoleDryRunSessionRoleOut(BaseModel):
    key: str
    label: str
    summary: str
    status: str
    ready_count: int
    attention_count: int
    total: int
    items: list[RoleDryRunSessionItemOut]


class RoleDryRunSessionOut(BaseModel):
    id: str
    session_id: str
    session_name: str
    status: str
    note: str | None = None
    started_by: str | None = None
    completed_by: str | None = None
    started_at: datetime | str
    updated_at: datetime
    completed_at: datetime | str | None = None
    checklist_generated_at: datetime | str | None = None
    item_count: int
    complete_count: int
    blocked_count: int
    pending_count: int
    roles: list[RoleDryRunSessionRoleOut]


class RoleDryRunSessionListOut(BaseModel):
    data: list[RoleDryRunSessionOut]
    total: int


class ProductionRehearsalSnapshotOut(BaseModel):
    id: str
    created_at: datetime
    status: str
    rehearsal_ready: bool
    score: int
    blocking_count: int
    warning_count: int
    recommended_action_count: int


class ProductionRehearsalSnapshotListOut(BaseModel):
    data: list[ProductionRehearsalSnapshotOut]
    total: int
