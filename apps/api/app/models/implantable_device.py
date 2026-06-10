"""Implantable device tracking for ONC criterion (a)(14).

Tracks UDI (Unique Device Identifier) for implanted medical devices
per FDA UDI rule and supports safety alerts/recalls.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DeviceStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    explanted = "explanted"
    unknown = "unknown"


class ImplantableDevice(Base):
    __tablename__ = "implantable_devices"

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
    udi: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    device_name: Mapped[str] = mapped_column(String(300), nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    model_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lot_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gmdn_pt_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gmdn_pt_definition: Mapped[str | None] = mapped_column(Text, nullable=True)
    implant_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    explant_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    status: Mapped[DeviceStatus] = mapped_column(
        SAEnum(DeviceStatus),
        default=DeviceStatus.active,
    )
    implanting_provider_npi: Mapped[str | None] = mapped_column(String(10), nullable=True)
    implanting_facility: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    safety_alert_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    safety_alert_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC).replace(tzinfo=None),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC).replace(tzinfo=None),
        onupdate=lambda: datetime.now(UTC).replace(tzinfo=None),
    )
