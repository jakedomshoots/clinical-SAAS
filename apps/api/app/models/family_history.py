"""Family health history models for ONC criterion (a)(12).

Supports pedigree data capture for hereditary conditions
cancer risk assessment, and genetic counseling referrals.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RelationshipType(str, enum.Enum):
    mother = "mother"
    father = "father"
    sister = "sister"
    brother = "brother"
    daughter = "daughter"
    son = "son"
    maternal_grandmother = "maternal_grandmother"
    maternal_grandfather = "maternal_grandfather"
    paternal_grandmother = "paternal_grandmother"
    paternal_grandfather = "paternal_grandfather"
    aunt = "aunt"
    uncle = "uncle"
    cousin = "cousin"
    niece = "niece"
    nephew = "nephew"
    half_sister = "half_sister"
    half_brother = "half_brother"


class LivingStatus(str, enum.Enum):
    alive = "alive"
    deceased = "deceased"
    unknown = "unknown"


class FamilyHistoryCondition(Base):
    __tablename__ = "family_history_conditions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    patient_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relative_relationship: Mapped[RelationshipType] = mapped_column(
        SAEnum(RelationshipType),
        nullable=False,
    )
    relative_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    living_status: Mapped[LivingStatus] = mapped_column(
        SAEnum(LivingStatus),
        default=LivingStatus.unknown,
    )
    age_at_diagnosis: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_at_death: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cause_of_death: Mapped[str | None] = mapped_column(String(200), nullable=True)
    condition_name: Mapped[str] = mapped_column(String(200), nullable=False)
    condition_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    condition_code_system: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_hereditary_risk: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC).replace(tzinfo=None),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC).replace(tzinfo=None),
        onupdate=lambda: datetime.now(UTC).replace(tzinfo=None),
    )
