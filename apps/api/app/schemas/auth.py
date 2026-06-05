from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime



class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)
    display_name: str
    role: str

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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
