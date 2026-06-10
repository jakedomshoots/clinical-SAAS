"""Social Determinants of Health (SDOH) screening models for ONC criterion (a)(15).

Supports PRAPARE, AHC-HRSN, and custom SDOH screening tools.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SDOHDomain(str, enum.Enum):
    housing = "housing"
    food_security = "food_security"
    transportation = "transportation"
    utilities = "utilities"
    interpersonal_safety = "interpersonal_safety"
    employment = "employment"
    education = "education"
    social_isolation = "social_isolation"
    stress = "stress"


class SDOHScreeningResponse(Base):
    __tablename__ = "sdoh_screening_responses"

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
    screening_tool: Mapped[str] = mapped_column(
        String(50), default="PRAPARE"
    )  # PRAPARE, AHC-HRSN, custom
    domain: Mapped[SDOHDomain] = mapped_column(SAEnum(SDOHDomain), nullable=False)
    question_code: Mapped[str] = mapped_column(String(50), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    response_value: Mapped[str] = mapped_column(String(500), nullable=False)
    response_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk_flag: Mapped[bool] = mapped_column(default=False)
    referral_needed: Mapped[bool] = mapped_column(default=False)
    referral_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    screened_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC).replace(tzinfo=None),
    )
    screened_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class SDOHReferral(Base):
    __tablename__ = "sdoh_referrals"

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
    domain: Mapped[SDOHDomain] = mapped_column(SAEnum(SDOHDomain), nullable=False)
    referral_type: Mapped[str] = mapped_column(String(100), nullable=False)
    organization_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    organization_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    organization_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="pending"
    )  # pending, active, completed, declined
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC).replace(tzinfo=None),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC).replace(tzinfo=None),
        onupdate=lambda: datetime.now(UTC).replace(tzinfo=None),
    )
