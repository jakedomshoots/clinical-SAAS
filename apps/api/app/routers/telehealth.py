"""Telehealth video visit router."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.integrations.telehealth import DailyClient
from app.models.schedule import Appointment
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/telehealth", tags=["Telehealth"])


@router.post("/visits")
async def create_visit(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a video visit for an appointment."""
    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id == data["appointment_id"],
            Appointment.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    client = DailyClient()
    result = await client.schedule_visit(
        appointment_id=str(appointment.id),
        provider_name=data.get("provider_name", "Provider"),
        patient_name=data.get("patient_name", "Patient"),
        scheduled_at=appointment.start_time or datetime.now(),
    )

    # Store room info on appointment
    appointment.video_room_url = result["room_url"]
    appointment.video_room_name = result["room_name"]
    db.commit()

    return result


@router.get("/visits/{appointment_id}/join")
async def get_join_url(
    appointment_id: str,
    role: str = "provider",  # "provider" or "patient"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get join URL for a video visit."""
    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id == appointment_id,
            Appointment.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if role == "provider":
        return {"join_url": appointment.video_room_url, "role": "provider"}
    else:
        return {"join_url": appointment.video_room_url, "role": "patient"}


@router.delete("/visits/{appointment_id}")
async def end_visit(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """End a video visit and clean up the room."""
    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id == appointment_id,
            Appointment.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.video_room_name:
        client = DailyClient()
        await client.delete_room(appointment.video_room_name)
        appointment.video_room_url = None
        appointment.video_room_name = None
        db.commit()

    return {"status": "ended"}
