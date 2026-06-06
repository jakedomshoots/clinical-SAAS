import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PatientDocumentStatus(str, enum.Enum):
    received = "received"
    needs_review = "needs_review"
    filed = "filed"
    reconciled = "reconciled"
    rejected = "rejected"


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class PatientDocument(Base):
    __tablename__ = "patient_documents"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    organization_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        default="default",
        index=True,
    )
    patient_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    source: Mapped[str] = mapped_column(String(200), nullable=False)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[PatientDocumentStatus] = mapped_column(
        SAEnum(PatientDocumentStatus),
        default=PatientDocumentStatus.received,
        nullable=False,
        index=True,
    )
    matched_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_contact: Mapped[str | None] = mapped_column(String(160), nullable=True)
    source_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_fax: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_reference: Mapped[str | None] = mapped_column(String(160), nullable=True)
    requested_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    routed_to_role: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    review_priority: Mapped[str] = mapped_column(String(50), default="normal", index=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    pages: Mapped[int] = mapped_column(Integer, default=1)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    upload_status: Mapped[str] = mapped_column(String(50), default="metadata_only", index=True)
    ocr_status: Mapped[str] = mapped_column(String(50), default="not_started", index=True)
    classification: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
