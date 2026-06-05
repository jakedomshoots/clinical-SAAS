from datetime import datetime
from typing import Any

from pydantic import BaseModel


class IntegrationEventOut(BaseModel):
    id: str
    organization_id: str
    integration: str
    direction: str
    action: str
    status: str
    entity_type: str | None
    entity_id: str | None
    idempotency_key: str | None
    attempts: int
    error: str | None
    payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IntegrationEventListOut(BaseModel):
    data: list[IntegrationEventOut]
    total: int
    page: int
    page_size: int
