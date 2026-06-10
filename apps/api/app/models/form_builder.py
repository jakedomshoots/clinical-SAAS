"""Custom form builder models for specialty-specific clinical forms.

Supports drag-and-drop form creation with various field types,
conditional logic, and scoring calculations.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class FieldType(str, enum.Enum):
    text = "text"
    textarea = "textarea"
    number = "number"
    date = "date"
    datetime = "datetime"
    checkbox = "checkbox"
    radio = "radio"
    select = "select"
    multiselect = "multiselect"
    yes_no = "yes_no"
    scale_1_10 = "scale_1_10"
    signature = "signature"
    file_upload = "file_upload"
    drawing = "drawing"
    calculated = "calculated"


class FormTemplate(Base):
    __tablename__ = "form_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(
        String(36), nullable=False, default="default", index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    specialty: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    category: Mapped[str] = mapped_column(
        String(100), nullable=False, default="general"
    )  # intake, consent, assessment, follow_up
    is_system_template: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(default=1)
    fields: Mapped[list] = mapped_column(JSON, default=list)
    conditional_logic: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scoring_rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class FormSubmission(Base):
    __tablename__ = "form_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(
        String(36), nullable=False, default="default", index=True
    )
    template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("form_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    submitted_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    submitted_by_patient: Mapped[bool] = mapped_column(Boolean, default=False)
    responses: Mapped[dict] = mapped_column(JSON, default=dict)
    calculated_score: Mapped[float | None] = mapped_column(default=None)
    risk_flags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    signature_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64 SVG or image
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class FormTemplateLibrary(Base):
    """Pre-built specialty form templates."""

    __tablename__ = "form_template_library"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    specialty: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    fields: Mapped[list] = mapped_column(JSON, default=list)
    conditional_logic: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scoring_rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
