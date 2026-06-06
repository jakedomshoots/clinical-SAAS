from datetime import datetime
from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    priority: str = "normal"
    due_date: datetime | None = None
    assigned_to_id: str | None = None
    patient_id: str | None = None
    source_type: str | None = Field(default=None, max_length=100)
    source_id: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    due_date: datetime | None = None
    assigned_to_id: str | None = None
    source_type: str | None = Field(default=None, max_length=100)
    source_id: str | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    description: str | None
    priority: str
    status: str
    due_date: str | None
    assigned_to_id: str | None
    assigned_to_name: str | None = None
    patient_id: str | None
    patient_name: str | None = None
    source_type: str | None = None
    source_id: str | None = None
    delivery_channel: str | None = None
    delivery_status: str | None = None
    delivery_recipient: str | None = None
    delivery_provider_message_id: str | None = None
    delivery_error: str | None = None
    delivery_attempts: int = 0
    delivered_at: str | None = None
    creator_id: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class TaskListOut(BaseModel):
    data: list[TaskOut]
    total: int
    page: int
    page_size: int


class TaskPatientOutreachDraftOut(BaseModel):
    task_id: str
    patient_id: str
    patient_name: str
    patient_email: str | None
    patient_phone: str | None
    preferred_contact_channel: str | None = None
    channel_options: list[dict]
    subject: str
    body: str


class TaskPatientOutreachSend(BaseModel):
    channel: str = "sms"
    subject: str
    body: str


class TaskPatientOutreachDeliveryOut(BaseModel):
    task_id: str
    patient_id: str
    channel: str
    delivery_status: str
    recipient: str | None
    subject: str
    provider_message_id: str | None = None
    attempts: int
    eligible: bool
    blocked_reason: str | None = None
    retryable: bool = False


class TaskOutreachSummaryOut(BaseModel):
    queued_count: int
    delivered_count: int
    failed_count: int
    blocked_count: int
    retryable_failed_count: int
    consent_blocked_count: int
    no_contact_blocked_count: int
    total_outreach_tasks: int
    consent_required: bool = True
