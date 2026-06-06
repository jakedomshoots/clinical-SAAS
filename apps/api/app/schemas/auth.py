from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    role: str
    organization_id: str
    is_active: bool
    mfa_enabled: bool
    password_must_change: bool
    temporary_password_expires_at: datetime | None
    last_login_at: datetime | None
    access_reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime



class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)
    display_name: str
    role: str
    organization_id: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        has_letter = any(char.isalpha() for char in value)
        has_number = any(char.isdigit() for char in value)
        has_symbol = any(not char.isalnum() for char in value)
        if not (has_letter and has_number and has_symbol):
            raise ValueError("Password must include a letter, number, and symbol")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordRotationComplete(BaseModel):
    email: EmailStr
    current_password: str
    new_password: str = Field(min_length=12)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        return UserCreate.validate_password_strength(value)


class PatientPortalLogin(BaseModel):
    email: EmailStr
    dob: str
    access_code: str = Field(min_length=8, max_length=128)


class PatientPortalPatientOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str | None
    organization_id: str

    model_config = ConfigDict(from_attributes=True)


class PatientPortalTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    patient: PatientPortalPatientOut


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SeedAdminOut(BaseModel):
    user: UserOut
    temporary_password: str
