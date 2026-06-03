from datetime import date
from pydantic import BaseModel, Field


class AddressSchema(BaseModel):
    street: str
    city: str
    state: str = Field(min_length=2, max_length=2)
    zip: str = Field(min_length=5, max_length=10)


class EmergencyContactSchema(BaseModel):
    name: str
    relationship: str
    phone: str


class InsuranceSchema(BaseModel):
    provider: str
    plan: str
    member_id: str
    group_number: str | None = None


class AllergySchema(BaseModel):
    substance: str
    reaction: str
    severity: str


class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    dob: date
    gender: str
    phone: str | None = None
    email: str | None = None
    address: AddressSchema | None = None
    emergency_contact: EmergencyContactSchema | None = None
    insurance: InsuranceSchema | None = None
    allergies: list[AllergySchema] = []
    problem_list: list[str] = []


class PatientUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    dob: date | None = None
    gender: str | None = None
    phone: str | None = None
    email: str | None = None
    address: AddressSchema | None = None
    emergency_contact: EmergencyContactSchema | None = None
    insurance: InsuranceSchema | None = None
    allergies: list[AllergySchema] | None = None
    problem_list: list[str] | None = None


class PatientOut(BaseModel):
    id: str
    mrn: str
    first_name: str
    last_name: str
    dob: str
    gender: str
    phone: str | None
    email: str | None
    address: dict | None
    emergency_contact: dict | None
    insurance: dict | None
    allergies: list[dict] | None
    problem_list: list[str] | None
    is_active: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class PatientListOut(BaseModel):
    data: list[PatientOut]
    total: int
    page: int
    page_size: int
