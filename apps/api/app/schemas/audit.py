from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditEventOut(BaseModel):
    id: str
    organization_id: str
    actor_id: str | None
    event_type: str
    entity_type: str
    entity_id: str
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditEventListOut(BaseModel):
    data: list[AuditEventOut]
    total: int
    page: int
    page_size: int


class PatientAccessHistoryOut(BaseModel):
    data: list[AuditEventOut]
    total: int


class AuditReviewCategoryOut(BaseModel):
    key: str
    label: str
    count: int
    severity: str
    event_types: list[str]
    last_event_at: datetime | None = None
    route: str


class AuditReviewActionOut(BaseModel):
    key: str
    label: str
    detail: str
    severity: str
    route: str


class AuditReviewSummaryOut(BaseModel):
    generated_at: str
    total_event_count: int
    sensitive_event_count: int
    categories: list[AuditReviewCategoryOut]
    recommended_actions: list[AuditReviewActionOut]
