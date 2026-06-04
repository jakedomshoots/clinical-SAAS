from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import front_office_write_required, get_current_user, manager_write_required
from app.models.user import User
from app.schemas.schedule import (
    AppointmentCreate, AppointmentListOut, AppointmentOut, AppointmentUpdate,
    AvailabilityCreate, AvailabilityOut,
)
from app.services import schedule_service

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


@router.get("/appointments", response_model=AppointmentListOut)
async def list_appointments(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    provider_id: str | None = Query(None),
    patient_id: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sd = datetime.fromisoformat(start_date) if start_date else None
    ed = datetime.fromisoformat(end_date) if end_date else None
    data, total = await schedule_service.list_appointments(db, sd, ed, provider_id, patient_id, status)
    return AppointmentListOut(data=[AppointmentOut(**a) for a in data], total=total)


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
async def get_appointment(appointment_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    appt = await schedule_service.get_appointment(db, appointment_id)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return AppointmentOut(**appt)


@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(data: AppointmentCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(front_office_write_required)):
    appt = await schedule_service.create_appointment(db, current_user, data.model_dump())
    return AppointmentOut(**appt)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(appointment_id: str, data: AppointmentUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(front_office_write_required)):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    appt = await schedule_service.update_appointment(db, current_user, appointment_id, update_data)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return AppointmentOut(**appt)


@router.post("/availability", response_model=AvailabilityOut, status_code=status.HTTP_201_CREATED)
async def set_availability(data: AvailabilityCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(manager_write_required)):
    avail = await schedule_service.set_availability(db, current_user, data.model_dump())
    return AvailabilityOut(**avail)


@router.get("/availability/{provider_id}", response_model=list[AvailabilityOut])
async def get_availability(provider_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    avail = await schedule_service.get_availability(db, provider_id)
    return [AvailabilityOut(**a) for a in avail]
