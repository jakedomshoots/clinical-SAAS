from datetime import datetime

from pydantic import BaseModel


class BillingCaseCreate(BaseModel):
    patient_id: str
    appointment_id: str | None = None
    payer: str | None = None
    cpt_codes: list[str] = []
    diagnosis_codes: list[str] = []
    notes: str | None = None


class BillingCaseUpdate(BaseModel):
    status: str | None = None
    payer: str | None = None
    eligibility_status: str | None = None
    claim_control_number: str | None = None
    remittance_status: str | None = None
    allowed_amount: float | None = None
    paid_amount: float | None = None
    cpt_codes: list[str] | None = None
    diagnosis_codes: list[str] | None = None
    notes: str | None = None


class BillingCaseOut(BaseModel):
    id: str
    patient_id: str
    appointment_id: str | None
    status: str
    payer: str | None
    eligibility_status: str
    claim_control_number: str | None
    submission_ready_at: datetime | None
    submitted_at: datetime | None
    denied_at: datetime | None
    denial_reason: str | None
    denial_worked_at: datetime | None
    remittance_status: str
    allowed_amount: float | None
    paid_amount: float | None
    paid_at: datetime | None
    cpt_codes: list[str]
    diagnosis_codes: list[str]
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BillingCaseListOut(BaseModel):
    data: list[BillingCaseOut]
    total: int


class ChargeReviewItemOut(BaseModel):
    encounter_id: str
    patient_id: str
    patient_name: str
    appointment_id: str | None
    encounter_type: str
    signed_at: datetime | None
    summary: str | None
    recommended_cpt_codes: list[str]
    recommended_diagnosis_codes: list[str]


class ChargeReviewListOut(BaseModel):
    data: list[ChargeReviewItemOut]
    total: int


class EligibilityCheckOut(BaseModel):
    patient_id: str
    payer: str | None
    status: str
    reference_id: str
    message: str


class BillingTimelineEventOut(BaseModel):
    id: str
    source: str = "audit"
    event_type: str
    entity_type: str
    entity_id: str
    actor_id: str | None
    payload: dict
    created_at: datetime
    status: str | None = None

    model_config = {"from_attributes": True}


class BillingTimelineOut(BaseModel):
    data: list[BillingTimelineEventOut]
    total: int


class BillingClaimReadinessOut(BaseModel):
    case_id: str
    ready: bool
    blockers: list[str]
    warnings: list[str]
    recommended_next_step: str


class BillingWorkQueueOut(BaseModel):
    draft_count: int
    ready_count: int
    submitted_count: int
    denied_count: int
    paid_count: int
    missing_coding_count: int
    eligibility_needed_count: int
    denial_rework_count: int
    remittance_pending_count: int
    total: int


class BillingPaymentIn(BaseModel):
    allowed_amount: float | None = None
    paid_amount: float | None = None
    remittance_status: str | None = None
    notes: str | None = None


class BillingReworkIn(BaseModel):
    notes: str | None = None
