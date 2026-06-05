import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BillingStatus(str, enum.Enum):
    draft = "draft"
    ready = "ready"
    submitted = "submitted"
    denied = "denied"
    paid = "paid"


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class BillingCase(Base):
    __tablename__ = "billing_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), nullable=False, default="default", index=True)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[BillingStatus] = mapped_column(SAEnum(BillingStatus), default=BillingStatus.draft, nullable=False, index=True)
    payer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    eligibility_status: Mapped[str] = mapped_column(String(50), default="not_checked", nullable=False, index=True)
    cpt_codes: Mapped[list] = mapped_column(JSON, default=list)
    diagnosis_codes: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
