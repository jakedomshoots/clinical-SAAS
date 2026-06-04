from datetime import datetime

from pydantic import BaseModel, Field


class AssistantFollowUpTaskRequest(BaseModel):
    context: str = Field(min_length=1, max_length=500)
    patient_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    priority: str = "high"
    due_date: datetime | None = None


class AssistantPortalReplyDraftRequest(BaseModel):
    context: str = Field(min_length=1, max_length=500)
    recipient_id: str
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    thread_id: str | None = None


class AssistantFaxMatchRequest(BaseModel):
    context: str = Field(min_length=1, max_length=500)
    fax_id: str
    patient_id: str
