import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MedicationStatus(str, enum.Enum):
    active = "active"
    review = "review"
    held = "held"
    discontinued = "discontinued"


class CarePlanStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"
    blocked = "blocked"


class LabResultStatus(str, enum.Enum):
    new = "new"
    needs_review = "needs_review"
    reviewed = "reviewed"
    filed = "filed"


class EncounterStatus(str, enum.Enum):
    draft = "draft"
    provider_review = "provider_review"
    signed = "signed"
    amended = "amended"


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class PatientMedication(Base):
    __tablename__ = "patient_medications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(
        String(36), nullable=False, default="default", index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    dose: Mapped[str | None] = mapped_column(String(100), nullable=True)
    directions: Mapped[str | None] = mapped_column(String(300), nullable=True)
    source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[MedicationStatus] = mapped_column(
        SAEnum(MedicationStatus), default=MedicationStatus.active, nullable=False, index=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PatientCarePlanItem(Base):
    __tablename__ = "patient_care_plan_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(
        String(36), nullable=False, default="default", index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_to_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    owner_role: Mapped[str] = mapped_column(String(100), nullable=False)
    item: Mapped[str] = mapped_column(String(500), nullable=False)
    due: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[CarePlanStatus] = mapped_column(
        SAEnum(CarePlanStatus), default=CarePlanStatus.open, nullable=False, index=True
    )
    escalation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PatientLabResult(Base):
    __tablename__ = "patient_lab_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(
        String(36), nullable=False, default="default", index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    collected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    panel: Mapped[str] = mapped_column(String(120), nullable=False)
    result: Mapped[str] = mapped_column(String(300), nullable=False)
    flag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[LabResultStatus] = mapped_column(
        SAEnum(LabResultStatus), default=LabResultStatus.new, nullable=False, index=True
    )
    source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PatientEncounter(Base):
    __tablename__ = "patient_encounters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(
        String(36), nullable=False, default="default", index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    encounter_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[EncounterStatus] = mapped_column(
        SAEnum(EncounterStatus), default=EncounterStatus.draft, nullable=False, index=True
    )
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    subjective: Mapped[str | None] = mapped_column(Text, nullable=True)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
