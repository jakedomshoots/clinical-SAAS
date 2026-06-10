from datetime import datetime
from typing import Literal

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


class AssistantPolicyOut(BaseModel):
    allowed_tools: list[str]
    confirmation_required: bool = True
    execution_mode: str = "staff_confirmed"


class AssistantRouteContext(BaseModel):
    path: str = Field(min_length=1)
    label: str = Field(min_length=1)
    entity_type: str | None = None
    entity_id: str | None = None


class AssistantUserContext(BaseModel):
    id: str
    role: str
    display_name: str


class AssistantWorkSummary(BaseModel):
    urgent_open_tasks: int = 0
    unread_threads: int = 0
    unmatched_inbound_faxes: int = 0
    today_appointments: int = 0
    readiness_blockers: int = 0


class AssistantContextOut(BaseModel):
    route: AssistantRouteContext
    user: AssistantUserContext
    allowed_tools: list[str]
    work_summary: AssistantWorkSummary
    assistant_rules: list[str]


AssistantProposalType = Literal[
    "navigation.open_route",
    "clinical.create_follow_up_task",
    "clinical.draft_portal_reply",
    "clinical.stage_fax_match",
    "operations.review_blocker",
]

AssistantProposalStatus = Literal["pending", "confirmed", "dismissed", "expired", "failed"]


class AssistantProposalCreate(BaseModel):
    proposal_type: AssistantProposalType
    title: str = Field(min_length=1, max_length=160)
    summary: str = Field(min_length=1, max_length=500)
    route_path: str = Field(min_length=1)
    entity_type: str | None = None
    entity_id: str | None = None
    payload: dict[str, object]
    confidence_reason: str = Field(min_length=1, max_length=500)
    source: Literal["clicky"] = "clicky"


class AssistantProposalOut(AssistantProposalCreate):
    id: str
    status: AssistantProposalStatus
    created_at: datetime
    created_by_user_id: str
    resolved_at: datetime | None = None
    resolved_by_user_id: str | None = None
