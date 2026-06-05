import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class ClinicSettings(Base):
    __tablename__ = "clinic_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    reminder_offsets_minutes: Mapped[list[int]] = mapped_column(JSON, default=lambda: [1440, 120])
    reminder_sms_template: Mapped[str] = mapped_column(
        Text,
        default="Reminder: you have an appointment with {clinic_name} on {appointment_time}. Reply STOP to opt out.",
    )
    reminder_email_template: Mapped[str] = mapped_column(
        Text,
        default="You have an appointment with {clinic_name} on {appointment_time}. Please arrive 10 minutes early.",
    )
    sender_identity: Mapped[str] = mapped_column(String(200), default="ConciergeOS Clinic")
    audit_retention_days: Mapped[int] = mapped_column(default=2555)
    phi_reauth_minutes: Mapped[int] = mapped_column(default=15)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
