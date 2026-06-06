from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.schedule import Appointment, AppointmentStatus, ProviderAvailability
from app.models.user import User
from app.services.audit_service import log_event
from app.services.integration_event_service import record_event


async def list_appointments(
    db: AsyncSession,
    user: User,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    provider_id: str | None = None,
    patient_id: str | None = None,
    status: str | None = None,
) -> tuple[list[dict], int]:
    if start_date is None:
        start_date = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    if end_date is None:
        end_date = start_date + timedelta(days=7)

    window = and_(Appointment.start_time >= start_date, Appointment.end_time <= end_date)
    query = select(Appointment).where(
        Appointment.organization_id == user.organization_id,
        window,
    )
    countq = select(func.count(Appointment.id)).where(
        Appointment.organization_id == user.organization_id,
        window,
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
    result = await db.execute(query.order_by(Appointment.start_time.asc()))
    appointments = result.scalars().all()

    prov_ids = {a.provider_id for a in appointments}
    pat_ids = {a.patient_id for a in appointments}
    prov_map: dict[str, str] = {}
    if prov_ids:
        u = await db.execute(
            select(User.id, User.display_name).where(
                User.id.in_(prov_ids),
                User.organization_id == user.organization_id,
            )
        )
        prov_map = {r.id: r.display_name for r in u}
    pat_map: dict[str, str] = {}
    if pat_ids:
        p = await db.execute(
            select(Patient.id, Patient.first_name, Patient.last_name).where(
                Patient.id.in_(pat_ids),
                Patient.organization_id == user.organization_id,
            )
        )
        pat_map = {r.id: f"{r.last_name}, {r.first_name}" for r in p}

    out = []
    for a in appointments:
        d = _make_appt_dict(a)
        d["patient_name"] = pat_map.get(a.patient_id)
        d["provider_name"] = prov_map.get(a.provider_id)
        out.append(d)
    return out, total


async def check_appointment_slot(
    db: AsyncSession,
    user: User,
    provider_id: str,
    start_time: datetime,
    end_time: datetime,
    exclude_appointment_id: str | None = None,
) -> dict:
    has_conflict = await _provider_has_conflict(db, user, provider_id, start_time, end_time, exclude_appointment_id)
    in_availability = await _provider_is_available(db, user, provider_id, start_time, end_time)
    warnings = []
    if has_conflict:
        warnings.append("Provider has a conflicting appointment in this time window")
    if not in_availability:
        warnings.append("Appointment is outside configured provider availability")
    suggested_slots = await _suggest_alternate_slots(db, user, provider_id, start_time, end_time)
    return {
        "provider_id": provider_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "has_conflict": has_conflict,
        "in_availability": in_availability,
        "warnings": warnings,
        "suggested_slots": suggested_slots,
    }


async def today_queue(
    db: AsyncSession,
    user: User,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> dict:
    appointments, total = await list_appointments(
        db,
        user,
        start_date=start_date,
        end_date=end_date,
    )
    queue_items = []
    checked_in = 0
    blocked = 0
    for appointment in appointments:
        from app.services.patient_chart_service import get_patient_chart_summary

        if appointment["status"] in {"checked_in", "roomed", "provider_review", "checkout", "in_progress"}:
            checked_in += 1
        summary = await get_patient_chart_summary(db, user, appointment["patient_id"])
        readiness = summary.checkout_readiness if summary else "ready"
        blockers = summary.blockers if summary else []
        if readiness == "blocked":
            blocked += 1
        counts = summary.counts if summary else None
        queue_items.append(
            {
                "appointment": appointment,
                "checkout_readiness": readiness,
                "blockers": blockers,
                "documents_needing_review": counts.documents_needing_review if counts else 0,
                "open_tasks": counts.open_tasks if counts else 0,
                "urgent_tasks": counts.urgent_tasks if counts else 0,
                "unsigned_encounters": counts.unsigned_encounters if counts else 0,
                "medications_needing_review": counts.medications_needing_review if counts else 0,
                "labs_needing_review": counts.labs_needing_review if counts else 0,
                "care_plan_blockers": counts.care_plan_blockers if counts else 0,
            }
        )
    return {
        "data": queue_items,
        "total": total,
        "checked_in": checked_in,
        "blocked": blocked,
    }


async def get_appointment(db: AsyncSession, user: User, appt_id: str) -> dict | None:
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appt_id,
            Appointment.organization_id == user.organization_id,
        )
    )
    a = result.scalar_one_or_none()
    if not a:
        return None
    d = _make_appt_dict(a)
    pat = (
        await db.execute(
            select(Patient).where(
                Patient.id == a.patient_id,
                Patient.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    prov = (
        await db.execute(
            select(User).where(
                User.id == a.provider_id,
                User.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    d["patient_name"] = f"{pat.last_name}, {pat.first_name}" if pat else None
    d["provider_name"] = prov.display_name if prov else None
    return d


async def create_appointment(db: AsyncSession, user: User, data: dict) -> dict | None:
    if not await _patient_exists(db, user, data["patient_id"]):
        return None
    if not await _provider_exists(db, user, data["provider_id"]):
        return None
    if await _provider_has_conflict(
        db,
        user,
        data["provider_id"],
        data["start_time"],
        data["end_time"],
    ):
        raise ValueError("Provider has a conflicting appointment in this time window")
    if not await _provider_is_available(db, user, data["provider_id"], data["start_time"], data["end_time"]):
        raise ValueError("Appointment is outside configured provider availability")

    appt = Appointment(
        organization_id=user.organization_id,
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
    await log_event(
        db,
        "appointment.created",
        "appointment",
        appt.id,
        actor_id=user.id,
        payload={"patient_id": appt.patient_id, "provider_id": appt.provider_id},
    )
    await record_event(
        db,
        user,
        integration="calendar",
        direction="outbound",
        action="appointment.create",
        status="pending",
        entity_type="appointment",
        entity_id=appt.id,
        idempotency_key=f"calendar:create:{appt.id}",
        payload={"patient_id": appt.patient_id, "provider_id": appt.provider_id, "start_time": appt.start_time.isoformat()},
    )
    return await get_appointment(db, user, appt.id)


async def update_appointment(db: AsyncSession, user: User, appt_id: str, data: dict) -> dict | None:
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appt_id,
            Appointment.organization_id == user.organization_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        return None
    before = {
        "start_time": appt.start_time.isoformat(),
        "end_time": appt.end_time.isoformat(),
        "provider_id": appt.provider_id,
        "status": appt.status.value,
    }
    if data.get("status") == AppointmentStatus.completed.value:
        from app.services.patient_chart_service import get_patient_chart_summary

        summary = await get_patient_chart_summary(db, user, appt.patient_id)
        if summary and summary.checkout_readiness == "blocked":
            raise ValueError("; ".join(summary.blockers) or "Chart blockers must be resolved before completion")
    next_provider_id = data.get("provider_id", appt.provider_id)
    next_start = data.get("start_time", appt.start_time)
    next_end = data.get("end_time", appt.end_time)
    if (
        ("start_time" in data or "end_time" in data or "provider_id" in data)
        and await _provider_has_conflict(db, user, next_provider_id, next_start, next_end, exclude_appointment_id=appt.id)
    ):
        raise ValueError("Provider has a conflicting appointment in this time window")
    for field, value in data.items():
        if hasattr(appt, field):
            setattr(appt, field, AppointmentStatus(value) if field == "status" else value)
    await db.commit()
    await db.refresh(appt)
    await log_event(
        db,
        f"appointment.{appt.status.value}",
        "appointment",
        appt.id,
        actor_id=user.id,
        payload={
            "status": appt.status.value,
            "updated_fields": list(data.keys()),
            "before": before,
            "after": {
                "start_time": appt.start_time.isoformat(),
                "end_time": appt.end_time.isoformat(),
                "provider_id": appt.provider_id,
                "status": appt.status.value,
            },
        },
    )
    await record_event(
        db,
        user,
        integration="calendar",
        direction="outbound",
        action="appointment.update",
        status="pending",
        entity_type="appointment",
        entity_id=appt.id,
        idempotency_key=f"calendar:update:{appt.id}:{appt.updated_at.isoformat() if appt.updated_at else 'pending'}",
        payload={
            "updated_fields": list(data.keys()),
            "status": appt.status.value,
            "start_time": appt.start_time.isoformat(),
            "end_time": appt.end_time.isoformat(),
        },
    )
    return await get_appointment(db, user, appt.id)


async def queue_appointment_reminders(db: AsyncSession, user: User, appt_id: str) -> dict | None:
    appointment = await get_appointment(db, user, appt_id)
    if not appointment:
        return None
    from app.services.settings_service import get_or_create_settings

    settings = await get_or_create_settings(db, user)

    event_ids: list[str] = []
    for offset_minutes in settings.reminder_offsets_minutes:
        for channel, template in (
            ("sms", settings.reminder_sms_template),
            ("email", settings.reminder_email_template),
        ):
            event = await record_event(
                db,
                user,
                integration="communications",
                direction="outbound",
                action=f"appointment.reminder.{channel}",
                status="pending",
                entity_type="appointment",
                entity_id=appt_id,
                idempotency_key=f"appointment:reminder:{channel}:{offset_minutes}:{appt_id}:{appointment['start_time']}",
                payload={
                    "patient_id": appointment["patient_id"],
                    "provider_id": appointment["provider_id"],
                    "appointment_start": appointment["start_time"],
                    "channel": channel,
                    "offset_minutes": offset_minutes,
                    "sender_identity": settings.sender_identity,
                    "template": template,
                },
            )
            event_ids.append(event.id)

    await log_event(
        db,
        "appointment.reminders_queued",
        "appointment",
        appt_id,
        actor_id=user.id,
        payload={"event_ids": event_ids, "channels": ["sms", "email"], "offsets": settings.reminder_offsets_minutes},
    )
    return {"appointment_id": appt_id, "queued": len(event_ids), "event_ids": event_ids}


async def set_availability(db: AsyncSession, user: User, data: dict) -> dict | None:
    if not await _provider_exists(db, user, data["provider_id"]):
        return None

    avail = ProviderAvailability(organization_id=user.organization_id, **data)
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


async def get_availability(db: AsyncSession, user: User, provider_id: str) -> list[dict]:
    result = await db.execute(
        select(ProviderAvailability)
        .where(
            ProviderAvailability.provider_id == provider_id,
            ProviderAvailability.organization_id == user.organization_id,
        )
        .order_by(ProviderAvailability.day_of_week, ProviderAvailability.start_time)
    )
    return [
        {
            "id": a.id,
            "provider_id": a.provider_id,
            "day_of_week": a.day_of_week,
            "start_time": a.start_time,
            "end_time": a.end_time,
        }
        for a in result.scalars().all()
    ]


def _make_appt_dict(a: Appointment) -> dict:
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "patient_name": None,
        "provider_id": a.provider_id,
        "provider_name": None,
        "start_time": a.start_time.isoformat() if a.start_time else None,
        "end_time": a.end_time.isoformat() if a.end_time else None,
        "type": a.type,
        "status": a.status.value,
        "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


async def _patient_exists(db: AsyncSession, user: User, patient_id: str) -> bool:
    result = await db.execute(
        select(Patient.id).where(
            Patient.id == patient_id,
            Patient.organization_id == user.organization_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _provider_exists(db: AsyncSession, user: User, provider_id: str) -> bool:
    result = await db.execute(
        select(User.id).where(
            User.id == provider_id,
            User.organization_id == user.organization_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _provider_has_conflict(
    db: AsyncSession,
    user: User,
    provider_id: str,
    start_time: datetime,
    end_time: datetime,
    exclude_appointment_id: str | None = None,
) -> bool:
    query = select(Appointment.id).where(
        Appointment.organization_id == user.organization_id,
        Appointment.provider_id == provider_id,
        Appointment.status.notin_([AppointmentStatus.cancelled, AppointmentStatus.no_show]),
        Appointment.start_time < end_time,
        Appointment.end_time > start_time,
    )
    if exclude_appointment_id:
        query = query.where(Appointment.id != exclude_appointment_id)
    return (await db.execute(query)).scalar_one_or_none() is not None


async def _provider_is_available(
    db: AsyncSession,
    user: User,
    provider_id: str,
    start_time: datetime,
    end_time: datetime,
) -> bool:
    result = await db.execute(
        select(ProviderAvailability).where(
            ProviderAvailability.organization_id == user.organization_id,
            ProviderAvailability.provider_id == provider_id,
            ProviderAvailability.day_of_week == ((start_time.weekday() + 1) % 7),
        )
    )
    start_hhmm = start_time.strftime("%H:%M")
    end_hhmm = end_time.strftime("%H:%M")
    rows = result.scalars().all()
    if not rows:
        return True
    return any(row.start_time <= start_hhmm and row.end_time >= end_hhmm for row in rows)


async def _suggest_alternate_slots(
    db: AsyncSession,
    user: User,
    provider_id: str,
    start_time: datetime,
    end_time: datetime,
) -> list[dict[str, str]]:
    duration = end_time - start_time
    suggestions: list[dict[str, str]] = []
    cursor = start_time + timedelta(minutes=30)
    for _ in range(32):
        candidate_end = cursor + duration
        if await _provider_is_available(db, user, provider_id, cursor, candidate_end) and not await _provider_has_conflict(db, user, provider_id, cursor, candidate_end):
            suggestions.append({"start_time": cursor.isoformat(), "end_time": candidate_end.isoformat()})
        if len(suggestions) >= 3:
            break
        cursor += timedelta(minutes=30)
    return suggestions
