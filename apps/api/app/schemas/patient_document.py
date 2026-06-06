from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class PatientDocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source: str = Field(min_length=1, max_length=200)
    document_type: str = Field(min_length=1, max_length=100)
    status: str = "received"
    matched_by: str | None = Field(default=None, max_length=100)
    source_contact: str | None = Field(default=None, max_length=160)
    source_phone: str | None = Field(default=None, max_length=50)
    source_fax: str | None = Field(default=None, max_length=50)
    source_reference: str | None = Field(default=None, max_length=160)
    requested_by: str | None = Field(default=None, max_length=120)
    routed_to_role: str | None = Field(default=None, max_length=80)
    review_priority: str | None = Field(default="normal", max_length=50)
    review_note: str | None = None
    reviewed_by: str | None = Field(default=None, max_length=120)
    reviewed_at: datetime | None = None
    pages: int = Field(default=1, ge=1)
    file_url: str | None = Field(default=None, max_length=500)
    upload_status: str | None = None
    ocr_status: str | None = None
    classification: str | None = None
    summary: str | None = None
    received_at: datetime | None = None


class PatientDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    source: str | None = Field(default=None, min_length=1, max_length=200)
    document_type: str | None = Field(default=None, min_length=1, max_length=100)
    status: str | None = None
    matched_by: str | None = Field(default=None, max_length=100)
    source_contact: str | None = Field(default=None, max_length=160)
    source_phone: str | None = Field(default=None, max_length=50)
    source_fax: str | None = Field(default=None, max_length=50)
    source_reference: str | None = Field(default=None, max_length=160)
    requested_by: str | None = Field(default=None, max_length=120)
    routed_to_role: str | None = Field(default=None, max_length=80)
    review_priority: str | None = Field(default=None, max_length=50)
    review_note: str | None = None
    reviewed_by: str | None = Field(default=None, max_length=120)
    reviewed_at: datetime | None = None
    pages: int | None = Field(default=None, ge=1)
    file_url: str | None = Field(default=None, max_length=500)
    upload_status: str | None = None
    ocr_status: str | None = None
    classification: str | None = None
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
    source_contact: str | None
    source_phone: str | None
    source_fax: str | None
    source_reference: str | None
    requested_by: str | None
    routed_to_role: str | None
    review_priority: str
    review_note: str | None
    reviewed_by: str | None
    reviewed_at: datetime | None
    pages: int
    file_url: str | None
    upload_status: str
    ocr_status: str
    classification: str | None
    summary: str | None
    received_at: datetime
    created_at: datetime
    updated_at: datetime

    @field_serializer("received_at", "created_at", "updated_at", "reviewed_at")
    def serialize_dt(self, dt: datetime | None) -> str | None:
        return dt.isoformat() if dt else None


class PatientDocumentListOut(BaseModel):
    data: list[PatientDocumentOut]
    total: int
    page: int
    page_size: int


class PatientDocumentQueueItemOut(PatientDocumentOut):
    patient_name: str
    patient_mrn: str
    patient_dob: date
    patient_phone: str | None = None

    @field_serializer("patient_dob")
    def serialize_date(self, value: date) -> str:
        return value.isoformat()


class PatientDocumentQueueOut(BaseModel):
    data: list[PatientDocumentQueueItemOut]
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
    access_token: str | None = None
    storage_status: str = "metadata_only"
    file_name: str | None = None
    source_uri_preview: str | None = None


class PatientDocumentProcessOut(BaseModel):
    document: PatientDocumentOut
    created_task_id: str | None = None


class PatientDocumentUploadPrepare(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)


class PatientDocumentUploadPrepareOut(BaseModel):
    upload_url: str
    file_url: str
    upload_token: str
    method: str = "PUT"
    expires_at: str
    headers: dict[str, str]


class PatientDocumentUploadConfirm(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source: str = Field(min_length=1, max_length=200)
    document_type: str = Field(min_length=1, max_length=100)
    file_url: str = Field(min_length=1, max_length=500)
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    upload_token: str = Field(min_length=1)
    checksum: str | None = Field(default=None, max_length=128)
    pages: int = Field(default=1, ge=1)
