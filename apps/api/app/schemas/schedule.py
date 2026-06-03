from datetime import datetime
from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    patient_id: str
    provider_id: str
    start_time: datetime
    end_time: datetime
    type: str = "office_visit"
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    start_time: datetime | None = None
    end_time: datetime | None = None
    type: str | None = None
    status: str | None = None
    notes: str | None = None


class AppointmentOut(BaseModel):
    id: str
    patient_id: str
    patient_name: str | None = None
    provider_id: str
    provider_name: str | None = None
    start_time: str
    end_time: str
    type: str
    status: str
    notes: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class AppointmentListOut(BaseModel):
    data: list[AppointmentOut]
    total: int


class AvailabilityCreate(BaseModel):
    provider_id: str
    day_of_week: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class AvailabilityOut(BaseModel):
    id: str
    provider_id: str
    day_of_week: int
    start_time: str
    end_time: str

    model_config = {"from_attributes": True}
