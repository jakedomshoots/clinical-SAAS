from pydantic import BaseModel, Field


class FaxSendRequest(BaseModel):
    to_number: str = Field(min_length=10)
    patient_id: str | None = None
    file_url: str | None = None
    pages: int = Field(default=1, ge=1)
    ocr_text: str | None = None


class FaxMatchRequest(BaseModel):
    patient_id: str


class FaxOut(BaseModel):
    id: str
    direction: str
    status: str
    from_number: str
    to_number: str
    pages: int
    file_url: str | None
    patient_id: str | None
    patient_name: str | None = None
    matched_by: str | None
    ocr_text: str | None
    created_at: str

    model_config = {"from_attributes": True}


class FaxListOut(BaseModel):
    data: list[FaxOut]
    total: int
    page: int
    page_size: int
