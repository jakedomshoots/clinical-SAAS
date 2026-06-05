from datetime import datetime

from pydantic import BaseModel


class PortalIntakeCreate(BaseModel):
    patient_id: str | None = None
    source: str = "portal"
    submitted_payload: dict


class PortalIntakeUpdate(BaseModel):
    patient_id: str | None = None
    status: str | None = None
    submitted_payload: dict | None = None


class PortalIntakeOut(BaseModel):
    id: str
    patient_id: str | None
    status: str
    source: str
    submitted_payload: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortalIntakeListOut(BaseModel):
    data: list[PortalIntakeOut]
    total: int
