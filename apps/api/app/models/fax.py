import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import enum


class FaxDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class FaxStatus(str, enum.Enum):
    pending = "pending"
    sending = "sending"
    sent = "sent"
    received = "received"
    processing = "processing"
    failed = "failed"


class Fax(Base):
    __tablename__ = "faxes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    direction: Mapped[FaxDirection] = mapped_column(SAEnum(FaxDirection), nullable=False)
    status: Mapped[FaxStatus] = mapped_column(SAEnum(FaxStatus), default=FaxStatus.pending)
    from_number: Mapped[str] = mapped_column(String(20), nullable=False)
    to_number: Mapped[str] = mapped_column(String(20), nullable=False)
    pages: Mapped[int] = mapped_column(Integer, default=1)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    patient_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True)
    matched_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ocr_text: Mapped[str | None] = mapped_column(String(10000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
