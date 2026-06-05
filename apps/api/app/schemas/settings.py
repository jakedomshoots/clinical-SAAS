from pydantic import BaseModel, Field


class ClinicSettingsOut(BaseModel):
    reminder_offsets_minutes: list[int]
    reminder_sms_template: str
    reminder_email_template: str
    sender_identity: str


class ClinicSettingsUpdate(BaseModel):
    reminder_offsets_minutes: list[int] | None = Field(default=None, min_length=1, max_length=4)
    reminder_sms_template: str | None = Field(default=None, min_length=10)
    reminder_email_template: str | None = Field(default=None, min_length=10)
    sender_identity: str | None = Field(default=None, min_length=2, max_length=200)
