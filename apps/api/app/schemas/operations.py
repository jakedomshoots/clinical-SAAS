from datetime import datetime

from pydantic import BaseModel


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


class RehearsalActionOut(BaseModel):
    key: str
    label: str
    detail: str
    route: str
    severity: str


class ProductionRehearsalReportOut(BaseModel):
    status: str
    rehearsal_ready: bool
    score: int
    blocking_count: int
    warning_count: int
    generated_at: datetime
    gates: list[RehearsalGateOut]
    recommended_actions: list[RehearsalActionOut]


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
