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


class TodayQueueItemOut(BaseModel):
    appointment: AppointmentOut
    checkout_readiness: str
    blockers: list[str]
    documents_needing_review: int
    open_tasks: int
    urgent_tasks: int
    unsigned_encounters: int


class TodayQueueOut(BaseModel):
    data: list[TodayQueueItemOut]
    total: int
    checked_in: int
    blocked: int


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


class AppointmentReminderOut(BaseModel):
    appointment_id: str
    queued: int
    event_ids: list[str]


class AppointmentConflictCheckOut(BaseModel):
    provider_id: str
    start_time: str
    end_time: str
    has_conflict: bool
    in_availability: bool
    warnings: list[str]
