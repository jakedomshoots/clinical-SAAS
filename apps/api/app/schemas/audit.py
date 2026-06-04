from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditEventOut(BaseModel):
    id: str
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
