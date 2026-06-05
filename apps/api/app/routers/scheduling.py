from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import front_office_write_required, get_current_user, manager_write_required
from app.models.user import User
from app.schemas.schedule import (
    AppointmentCreate,
    AppointmentListOut,
    AppointmentOut,
    AppointmentUpdate,
    AvailabilityCreate,
    AvailabilityOut,
    TodayQueueOut,
)
from app.services import schedule_service

router = APIRouter(prefix="/api/schedule", tags=["schedule"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
FrontOfficeUserDep = Annotated[User, Depends(front_office_write_required)]
ManagerUserDep = Annotated[User, Depends(manager_write_required)]


@router.get("/appointments", response_model=AppointmentListOut)
async def list_appointments(
    db: DbDep,
    current_user: CurrentUserDep,
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    provider_id: str | None = Query(None),
    patient_id: str | None = Query(None),
    status: str | None = Query(None),
):
    sd = datetime.fromisoformat(start_date) if start_date else None
    ed = datetime.fromisoformat(end_date) if end_date else None
    data, total = await schedule_service.list_appointments(
        db,
        current_user,
        sd,
        ed,
        provider_id,
        patient_id,
        status,
    )
    return AppointmentListOut(data=[AppointmentOut(**a) for a in data], total=total)


@router.get("/today-queue", response_model=TodayQueueOut)
async def today_queue(
    db: DbDep,
    current_user: CurrentUserDep,
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    sd = datetime.fromisoformat(start_date) if start_date else None
    ed = datetime.fromisoformat(end_date) if end_date else None
    return await schedule_service.today_queue(db, current_user, sd, ed)


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
async def get_appointment(
    appointment_id: str,
    db: DbDep,
    current_user: CurrentUserDep,
):
    appt = await schedule_service.get_appointment(db, current_user, appointment_id)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return AppointmentOut(**appt)


@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    data: AppointmentCreate,
    db: DbDep,
    current_user: FrontOfficeUserDep,
):
    try:
        appt = await schedule_service.create_appointment(db, current_user, data.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not appt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient or provider not found",
        )
    return AppointmentOut(**appt)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    appointment_id: str,
    data: AppointmentUpdate,
    db: DbDep,
    current_user: FrontOfficeUserDep,
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    try:
        appt = await schedule_service.update_appointment(db, current_user, appointment_id, update_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return AppointmentOut(**appt)


@router.post("/availability", response_model=AvailabilityOut, status_code=status.HTTP_201_CREATED)
async def set_availability(
    data: AvailabilityCreate,
    db: DbDep,
    current_user: ManagerUserDep,
):
    avail = await schedule_service.set_availability(db, current_user, data.model_dump())
    if not avail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return AvailabilityOut(**avail)


@router.get("/availability/{provider_id}", response_model=list[AvailabilityOut])
async def get_availability(provider_id: str, db: DbDep, current_user: CurrentUserDep):
    avail = await schedule_service.get_availability(db, current_user, provider_id)
    return [AvailabilityOut(**a) for a in avail]
