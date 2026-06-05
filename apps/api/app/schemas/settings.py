from pydantic import BaseModel, Field


class ClinicSettingsOut(BaseModel):
    reminder_offsets_minutes: list[int]
    reminder_sms_template: str
    reminder_email_template: str
    sender_identity: str
    audit_retention_days: int
    phi_reauth_minutes: int


class ClinicSettingsUpdate(BaseModel):
    reminder_offsets_minutes: list[int] | None = Field(default=None, min_length=1, max_length=4)
    reminder_sms_template: str | None = Field(default=None, min_length=10)
    reminder_email_template: str | None = Field(default=None, min_length=10)
    sender_identity: str | None = Field(default=None, min_length=2, max_length=200)
    audit_retention_days: int | None = Field(default=None, ge=365, le=3650)
    phi_reauth_minutes: int | None = Field(default=None, ge=5, le=60)
