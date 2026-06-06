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


class LaunchWorkplanSnapshotListOut(BaseModel):
    data: list[LaunchWorkplanSnapshotOut]
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
