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
