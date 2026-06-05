from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class PatientDocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source: str = Field(min_length=1, max_length=200)
    document_type: str = Field(min_length=1, max_length=100)
    status: str = "received"
    matched_by: str | None = Field(default=None, max_length=100)
    pages: int = Field(default=1, ge=1)
    file_url: str | None = Field(default=None, max_length=500)
    summary: str | None = None
    received_at: datetime | None = None


class PatientDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    source: str | None = Field(default=None, min_length=1, max_length=200)
    document_type: str | None = Field(default=None, min_length=1, max_length=100)
    status: str | None = None
    matched_by: str | None = Field(default=None, max_length=100)
    pages: int | None = Field(default=None, ge=1)
    file_url: str | None = Field(default=None, max_length=500)
    summary: str | None = None
    received_at: datetime | None = None


class PatientDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    title: str
    source: str
    document_type: str
    status: str
    matched_by: str | None
    pages: int
    file_url: str | None
    summary: str | None
    received_at: datetime
    created_at: datetime
    updated_at: datetime

    @field_serializer("received_at", "created_at", "updated_at")
    def serialize_dt(self, dt: datetime) -> str:
        return dt.isoformat() if dt else ""


class PatientDocumentListOut(BaseModel):
    data: list[PatientDocumentOut]
    total: int
    page: int
    page_size: int


class PatientDocumentAccessOut(BaseModel):
    document_id: str
    available: bool
    url: str | None
    expires_at: str | None
    reason: str | None = None
    preview_supported: bool = False
    content_type: str | None = None
    viewer_mode: str = "metadata"
