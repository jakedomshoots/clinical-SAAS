from typing import Any

from pydantic import BaseModel, Field


class WebhookIn(BaseModel):
    organization_id: str = "default"
    event_id: str | None = Field(default=None, max_length=120)
    action: str = Field(min_length=1, max_length=100)
    entity_type: str | None = Field(default=None, max_length=50)
    entity_id: str | None = Field(default=None, max_length=36)
    payload: dict[str, Any] = Field(default_factory=dict)


class WebhookOut(BaseModel):
    id: str
    integration: str
    status: str
    duplicate: bool = False
    applied: bool = False
