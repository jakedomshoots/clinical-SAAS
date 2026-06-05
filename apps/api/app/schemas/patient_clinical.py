from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class PatientMedicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    dose: str | None = Field(default=None, max_length=100)
    directions: str | None = Field(default=None, max_length=300)
    source: str | None = Field(default=None, max_length=200)
    status: str = "active"
    note: str | None = None


class PatientMedicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    dose: str | None = Field(default=None, max_length=100)
    directions: str | None = Field(default=None, max_length=300)
    source: str | None = Field(default=None, max_length=200)
    status: str | None = None
    note: str | None = None


class PatientMedicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    name: str
    dose: str | None
    directions: str | None
    source: str | None
    status: str
    note: str | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: datetime) -> str:
        return dt.isoformat() if dt else ""


class PatientMedicationListOut(BaseModel):
    data: list[PatientMedicationOut]
    total: int


class PatientCarePlanItemCreate(BaseModel):
    assigned_to_id: str | None = None
    owner_role: str = Field(min_length=1, max_length=100)
    item: str = Field(min_length=1, max_length=500)
    due: str | None = Field(default=None, max_length=100)
    status: str = "open"
    escalation: str | None = Field(default=None, max_length=100)
    note: str | None = None


class PatientCarePlanItemUpdate(BaseModel):
    assigned_to_id: str | None = None
    owner_role: str | None = Field(default=None, min_length=1, max_length=100)
    item: str | None = Field(default=None, min_length=1, max_length=500)
    due: str | None = Field(default=None, max_length=100)
    status: str | None = None
    escalation: str | None = Field(default=None, max_length=100)
    note: str | None = None


class PatientCarePlanItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    assigned_to_id: str | None
    assigned_to_name: str | None = None
    owner_role: str
    item: str
    due: str | None
    status: str
    escalation: str | None
    note: str | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: datetime) -> str:
        return dt.isoformat() if dt else ""


class PatientCarePlanItemListOut(BaseModel):
    data: list[PatientCarePlanItemOut]
    total: int


class PatientLabResultCreate(BaseModel):
    collected_at: datetime | None = None
    panel: str = Field(min_length=1, max_length=120)
    result: str = Field(min_length=1, max_length=300)
    flag: str | None = Field(default=None, max_length=50)
    status: str = "new"
    source: str | None = Field(default=None, max_length=200)
    note: str | None = None


class PatientLabResultUpdate(BaseModel):
    collected_at: datetime | None = None
    panel: str | None = Field(default=None, min_length=1, max_length=120)
    result: str | None = Field(default=None, min_length=1, max_length=300)
    flag: str | None = Field(default=None, max_length=50)
    status: str | None = None
    source: str | None = Field(default=None, max_length=200)
    note: str | None = None


class PatientLabResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    collected_at: datetime | None
    panel: str
    result: str
    flag: str | None
    status: str
    source: str | None
    note: str | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("collected_at", "created_at", "updated_at")
    def serialize_dt(self, dt: datetime | None) -> str | None:
        return dt.isoformat() if dt else None


class PatientLabResultListOut(BaseModel):
    data: list[PatientLabResultOut]
    total: int


class PatientEncounterCreate(BaseModel):
    appointment_id: str | None = None
    provider_id: str | None = None
    encounter_type: str = Field(default="office_visit", min_length=1, max_length=100)
    status: str = "draft"
    summary: str | None = None
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None


class PatientEncounterUpdate(BaseModel):
    appointment_id: str | None = None
    provider_id: str | None = None
    encounter_type: str | None = Field(default=None, min_length=1, max_length=100)
    status: str | None = None
    summary: str | None = None
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None


class PatientEncounterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    appointment_id: str | None
    provider_id: str | None
    provider_name: str | None = None
    encounter_type: str
    status: str
    summary: str | None
    subjective: str | None
    objective: str | None
    assessment: str | None
    plan: str | None
    signed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("signed_at", "created_at", "updated_at")
    def serialize_dt(self, dt: datetime | None) -> str | None:
        return dt.isoformat() if dt else None


class PatientEncounterListOut(BaseModel):
    data: list[PatientEncounterOut]
    total: int
