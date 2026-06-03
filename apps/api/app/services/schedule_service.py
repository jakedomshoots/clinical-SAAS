from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule import Appointment, AppointmentStatus, ProviderAvailability
from app.models.user import User
from app.models.patient import Patient
from app.services.audit_service import log_event


def _appt_to_dict(a: Appointment, pat_name: str | None = None, prov_name: str | None = None) -> dict:
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "patient_name": pat_name,
        "provider_id": a.provider_id,
        "provider_name": prov_name,
        "start_time": a.start_time.isoformat() if a.start_time else None,
        "end_time": a.end_time.isoformat() if a.end_time else None,
        "type": a.type,
        "status": a.status.value,
        "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


async def list_appointments(
    db: AsyncSession,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    provider_id: str | None = None,
    patient_id: str | None = None,
    status: str | None = None,
) -> tuple[list[dict], int]:
    if start_date is None:
        start_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if end_date is None:
        end_date = start_date + timedelta(days=7)

    query = select(Appointment).where(
        and_(Appointment.start_time >= start_date, Appointment.end_time <= end_date)
    )
    countq = select(func.count(Appointment.id)).where(
        and_(Appointment.start_time >= start_date, Appointment.end_time <= end_date)
    )

    if provider_id:
        query = query.where(Appointment.provider_id == provider_id)
        countq = countq.where(Appointment.provider_id == provider_id)
    if patient_id:
        query = query.where(Appointment.patient_id == patient_id)
        countq = countq.where(Appointment.patient_id == patient_id)
    if status:
        query = query.where(Appointment.status == AppointmentStatus(status))
        countq = countq.where(Appointment.status == AppointmentStatus(status))

    total = (await db.execute(countq)).scalar() or 0
    query = query.order_by(Appointment.start_time.asc())
    result = await db.execute(query)
    appointments = result.scalars().all()

    prov_ids = {a.provider_id for a in appointments}
    pat_ids = {a.patient_id for a in appointments}

    prov_map: dict[str, str] = {}
    if prov_ids:
        u = await db.execute(select(User.id, User.display_name).where(User.id.in_(prov_ids)))
        prov_map = {r.id: r.display_name for r in u}

    pat_map: dict[str, str] = {}
    if pat_ids:
        p = await db.execute(select(Patient.id, Patient.first_name, Patient.last_name).where(Patient.id.in_(pat_ids)))
        pat_map = {r.id: f"{r.last_name}, {r.first_name}" for r in p}

    return [_appt_to_dict(a, pat_map.get(a.patient_id), prov_map.get(a.provider_id)) for a in appointments], total


async def get_appointment(db: AsyncSession, appt_id: str) -> dict | None:
    result = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    a = result.scalar_one_or_none()
    if not a:
        return None

    pat = await db.get(Patient, a.patient_id)
    prov = await db.get(User, a.provider_id)
    return _appt_to_dict(a, f"{pat.last_name}, {pat.first_name}" if pat else None, prov.display_name if prov else None)


async def create_appointment(db: AsyncSession, user: User, data: dict) -> dict:
    appt = Appointment(
        patient_id=data["patient_id"],
        provider_id=data["provider_id"],
        start_time=data["start_time"],
        end_time=data["end_time"],
        type=data.get("type", "office_visit"),
        notes=data.get("notes"),
        status=AppointmentStatus.scheduled,
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)

    await log_event(db, "appointment.created", "appointment", appt.id, actor_id=user.id, payload={"patient_id": appt.patient_id, "provider_id": appt.provider_id})
    return await get_appointment(db, appt.id)


async def update_appointment(db: AsyncSession, user: User, appt_id: str, data: dict) -> dict | None:
    result = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = result.scalar_one_or_none()
    if not appt:
        return None

    for field, value in data.items():
        if value is not None and hasattr(appt, field):
            if field == "status":
                setattr(appt, field, AppointmentStatus(value))
            else:
                setattr(appt, field, value)

    await db.commit()
    await db.refresh(appt)

    await log_event(db, f"appointment.{appt.status.value}", "appointment", appt.id, actor_id=user.id, payload={"status": appt.status.value})
    return await get_appointment(db, appt.id)


async def set_availability(db: AsyncSession, user: User, data: dict) -> dict:
    avail = ProviderAvailability(
        provider_id=data["provider_id"],
        day_of_week=data["day_of_week"],
        start_time=data["start_time"],
        end_time=data["end_time"],
    )
    db.add(avail)
    await db.commit()
    await db.refresh(avail)

    return {
        "id": avail.id,
        "provider_id": avail.provider_id,
        "day_of_week": avail.day_of_week,
        "start_time": avail.start_time,
        "end_time": avail.end_time,
    }


async def get_availability(db: AsyncSession, provider_id: str) -> list[dict]:
    result = await db.execute(
        select(ProviderAvailability)
        .where(ProviderAvailability.provider_id == provider_id)
        .order_by(ProviderAvailability.day_of_week, ProviderAvailability.start_time)
    )
    availabilities = result.scalars().all()
    return [
        {"id": a.id, "provider_id": a.provider_id, "day_of_week": a.day_of_week, "start_time": a.start_time, "end_time": a.end_time}
        for a in availabilities
    ]
