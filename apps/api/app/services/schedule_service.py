from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule import Appointment, AppointmentStatus, ProviderAvailability
from app.models.user import User
from app.models.patient import Patient
from app.services.audit_service import log_event


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

    query = select(Appointment).where(and_(Appointment.start_time >= start_date, Appointment.end_time <= end_date))
    countq = select(func.count(Appointment.id)).where(and_(Appointment.start_time >= start_date, Appointment.end_time <= end_date))

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
    result = await db.execute(query.order_by(Appointment.start_time.asc()))
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

    out = []
    for a in appointments:
        d = _make_appt_dict(a)
        d["patient_name"] = pat_map.get(a.patient_id)
        d["provider_name"] = prov_map.get(a.provider_id)
        out.append(d)
    return out, total


async def get_appointment(db: AsyncSession, appt_id: str) -> dict | None:
    result = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    a = result.scalar_one_or_none()
    if not a:
        return None
    d = _make_appt_dict(a)
    pat = await db.get(Patient, a.patient_id)
    prov = await db.get(User, a.provider_id)
    d["patient_name"] = f"{pat.last_name}, {pat.first_name}" if pat else None
    d["provider_name"] = prov.display_name if prov else None
    return d


async def create_appointment(db: AsyncSession, user: User, data: dict) -> dict:
    appt = Appointment(
        patient_id=data["patient_id"], provider_id=data["provider_id"],
        start_time=data["start_time"], end_time=data["end_time"],
        type=data.get("type", "office_visit"), notes=data.get("notes"),
        status=AppointmentStatus.scheduled,
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)
    await log_event(db, "appointment.created", "appointment", appt.id, actor_id=user.id,
                    payload={"patient_id": appt.patient_id, "provider_id": appt.provider_id})
    return await get_appointment(db, appt.id)


async def update_appointment(db: AsyncSession, user: User, appt_id: str, data: dict) -> dict | None:
    result = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = result.scalar_one_or_none()
    if not appt:
        return None
    for field, value in data.items():
        if hasattr(appt, field):
            setattr(appt, field, AppointmentStatus(value) if field == "status" else value)
    await db.commit()
    await db.refresh(appt)
    await log_event(db, f"appointment.{appt.status.value}", "appointment", appt.id, actor_id=user.id,
                    payload={"status": appt.status.value})
    return await get_appointment(db, appt.id)


async def set_availability(db: AsyncSession, user: User, data: dict) -> dict:
    avail = ProviderAvailability(**data)
    db.add(avail)
    await db.commit()
    await db.refresh(avail)
    return {"id": avail.id, "provider_id": avail.provider_id, "day_of_week": avail.day_of_week,
            "start_time": avail.start_time, "end_time": avail.end_time}


async def get_availability(db: AsyncSession, provider_id: str) -> list[dict]:
    result = await db.execute(
        select(ProviderAvailability).where(ProviderAvailability.provider_id == provider_id)
        .order_by(ProviderAvailability.day_of_week, ProviderAvailability.start_time))
    return [{"id": a.id, "provider_id": a.provider_id, "day_of_week": a.day_of_week,
             "start_time": a.start_time, "end_time": a.end_time} for a in result.scalars().all()]


def _make_appt_dict(a: Appointment) -> dict:
    return {
        "id": a.id, "patient_id": a.patient_id, "patient_name": None,
        "provider_id": a.provider_id, "provider_name": None,
        "start_time": a.start_time.isoformat() if a.start_time else None,
        "end_time": a.end_time.isoformat() if a.end_time else None,
        "type": a.type, "status": a.status.value, "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }
