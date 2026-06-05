import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PortalIntakeStatus(str, enum.Enum):
    received = "received"
    needs_review = "needs_review"
    applied = "applied"
    rejected = "rejected"


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class PortalIntakeSubmission(Base):
    __tablename__ = "portal_intake_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), nullable=False, default="default", index=True)
    patient_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[PortalIntakeStatus] = mapped_column(SAEnum(PortalIntakeStatus), default=PortalIntakeStatus.received, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(100), default="portal", nullable=False)
    submitted_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
