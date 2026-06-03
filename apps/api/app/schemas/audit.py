from pydantic import BaseModel
from datetime import datetime


class AuditEventOut(BaseModel):
    id: str
    actor_id: str | None
    event_type: str
    entity_type: str
    entity_id: str
    payload: dict
    created_at: datetime

    model_config = {"from_attributes": True}
