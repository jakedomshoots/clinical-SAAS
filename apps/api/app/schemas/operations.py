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
