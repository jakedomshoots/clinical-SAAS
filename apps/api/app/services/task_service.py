from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.services.audit_service import log_event


async def list_tasks(
    db: AsyncSession,
    user: User,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    priority: str | None = None,
    assigned_to_id: str | None = None,
    patient_id: str | None = None,
    search: str | None = None,
) -> tuple[list[dict], int]:
    query = select(Task).where(Task.organization_id == user.organization_id)
    countq = select(func.count(Task.id)).where(Task.organization_id == user.organization_id)

    if status:
        query = query.where(Task.status == TaskStatus(status))
        countq = countq.where(Task.status == TaskStatus(status))
    if priority:
        query = query.where(Task.priority == TaskPriority(priority))
        countq = countq.where(Task.priority == TaskPriority(priority))
    if assigned_to_id:
        query = query.where(Task.assigned_to_id == assigned_to_id)
        countq = countq.where(Task.assigned_to_id == assigned_to_id)
    if patient_id:
        query = query.where(Task.patient_id == patient_id)
        countq = countq.where(Task.patient_id == patient_id)
    if search:
        st = f"%{search}%"
        query = query.where(Task.title.ilike(st))
        countq = countq.where(Task.title.ilike(st))

    total = (await db.execute(countq)).scalar() or 0
    offset = (page - 1) * page_size
    query = query.order_by(
        Task.priority.desc(),
        Task.due_date.asc().nulls_last(),
        Task.created_at.desc(),
    )
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    tasks = result.scalars().all()

    user_ids = {t.assigned_to_id for t in tasks if t.assigned_to_id}
    patient_ids = {t.patient_id for t in tasks if t.patient_id}
    user_map: dict[str, str] = {}
    if user_ids:
        u = await db.execute(
            select(User.id, User.display_name).where(
                User.id.in_(user_ids),
                User.organization_id == user.organization_id,
            )
        )
        user_map = {r.id: r.display_name for r in u}
    patient_map: dict[str, str] = {}
    if patient_ids:
        p = await db.execute(
            select(Patient.id, Patient.first_name, Patient.last_name).where(
                Patient.id.in_(patient_ids),
                Patient.organization_id == user.organization_id,
            )
        )
        patient_map = {r.id: f"{r.last_name}, {r.first_name}" for r in p}

    out = []
    for t in tasks:
        d = _make_task_dict(t)
        d["assigned_to_name"] = user_map.get(t.assigned_to_id)
        d["patient_name"] = patient_map.get(t.patient_id)
        out.append(d)
    return out, total


async def get_task(db: AsyncSession, user: User, task_id: str) -> dict | None:
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.organization_id == user.organization_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        return None
    d = _make_task_dict(task)
    if task.assigned_to_id:
        u = (
            await db.execute(
                select(User).where(
                    User.id == task.assigned_to_id,
                    User.organization_id == user.organization_id,
                )
            )
        ).scalar_one_or_none()
        d["assigned_to_name"] = u.display_name if u else None
    if task.patient_id:
        p = (
            await db.execute(
                select(Patient).where(
                    Patient.id == task.patient_id,
                    Patient.organization_id == user.organization_id,
                )
            )
        ).scalar_one_or_none()
        d["patient_name"] = f"{p.last_name}, {p.first_name}" if p else None
    return d


async def create_task(db: AsyncSession, user: User, data: dict) -> dict | None:
    assigned_to_id = data.get("assigned_to_id")
    if assigned_to_id and not await _user_in_org(db, user, assigned_to_id):
        return None
    task = Task(
        organization_id=user.organization_id,
        title=data["title"],
        description=data.get("description"),
        priority=TaskPriority(data.get("priority", "normal")),
        status=TaskStatus.open,
        due_date=data.get("due_date"),
        assigned_to_id=assigned_to_id,
        patient_id=data.get("patient_id"),
        source_type=data.get("source_type"),
        source_id=data.get("source_id"),
        creator_id=user.id,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await log_event(
        db,
        "task.created",
        "task",
        task.id,
        actor_id=user.id,
        payload={"title": task.title},
    )
    return await get_task(db, user, task.id)


async def update_task(db: AsyncSession, user: User, task_id: str, data: dict) -> dict | None:
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.organization_id == user.organization_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        return None
    if "assigned_to_id" in data and data["assigned_to_id"] and not await _user_in_org(
        db,
        user,
        data["assigned_to_id"],
    ):
        return None
    before = {
        "status": task.status.value,
        "priority": task.priority.value,
        "assigned_to_id": task.assigned_to_id,
        "due_date": task.due_date.isoformat() if task.due_date else None,
    }
    for field, value in data.items():
        if hasattr(task, field):
            if field == "priority":
                setattr(task, field, TaskPriority(value))
            elif field == "status":
                setattr(task, field, TaskStatus(value))
            else:
                setattr(task, field, value)
    await db.commit()
    await db.refresh(task)
    after = {
        "status": task.status.value,
        "priority": task.priority.value,
        "assigned_to_id": task.assigned_to_id,
        "due_date": task.due_date.isoformat() if task.due_date else None,
    }
    event_type = f"task.{task.status.value}" if before["status"] != task.status.value else "task.updated"
    await log_event(
        db,
        event_type,
        "task",
        task.id,
        actor_id=user.id,
        payload={
            "title": task.title,
            "updated_fields": list(data.keys()),
            "before": before,
            "after": after,
        },
    )
    return await get_task(db, user, task.id)


async def draft_patient_outreach(db: AsyncSession, user: User, task_id: str) -> dict | None:
    result = await db.execute(
        select(Task, Patient).join(Patient, Task.patient_id == Patient.id).where(
            Task.id == task_id,
            Task.organization_id == user.organization_id,
            Patient.organization_id == user.organization_id,
        )
    )
    row = result.first()
    if not row:
        return None
    task, patient = row
    patient_name = f"{patient.first_name} {patient.last_name}"
    return {
        "task_id": task.id,
        "patient_id": patient.id,
        "patient_name": patient_name,
        "patient_email": patient.email,
        "patient_phone": patient.phone,
        "subject": f"Follow-up from your care team: {task.title}",
        "body": (
            f"Hi {patient.first_name},\n\n"
            "Your care team is following up on an item from your visit. "
            f"We are reviewing: {task.title}.\n\n"
            "Please contact the office if you have new symptoms, medication changes, "
            "or questions before we reach you.\n\n"
            "Thank you,\nYour care team"
        ),
    }


async def stage_patient_outreach_delivery(
    db: AsyncSession,
    user: User,
    task_id: str,
    data: dict,
) -> dict | None:
    draft = await draft_patient_outreach(db, user, task_id)
    if not draft:
        return None
    channel = data.get("channel", "sms")
    recipient = draft["patient_phone"] if channel == "sms" else draft["patient_email"]
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.organization_id == user.organization_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        return None
    task.delivery_channel = channel
    task.delivery_status = "queued" if recipient else "blocked"
    task.delivery_recipient = recipient
    task.delivery_provider_message_id = f"pending-{task.id}"
    task.delivery_error = None if recipient else f"No {channel} recipient is available for this patient."
    task.delivery_attempts = (task.delivery_attempts or 0) + 1
    task.delivery_payload = {
        "subject": data["subject"],
        "body": data["body"],
    }
    await db.commit()
    await db.refresh(task)
    await log_event(
        db,
        "patient_outreach.staged",
        "task",
        task_id,
        actor_id=user.id,
        payload={
            "patient_id": draft["patient_id"],
            "channel": channel,
            "recipient": recipient,
            "subject": data["subject"],
            "delivery_status": task.delivery_status,
        },
    )
    return {
        "task_id": task_id,
        "patient_id": draft["patient_id"],
        "channel": channel,
        "delivery_status": task.delivery_status,
        "recipient": recipient,
        "subject": data["subject"],
        "provider_message_id": task.delivery_provider_message_id,
        "attempts": task.delivery_attempts,
    }


async def _user_in_org(db: AsyncSession, user: User, user_id: str) -> bool:
    result = await db.execute(
        select(User.id).where(
            User.id == user_id,
            User.organization_id == user.organization_id,
            User.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none() is not None


def _make_task_dict(t: Task) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "priority": t.priority.value,
        "status": t.status.value,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "assigned_to_id": t.assigned_to_id,
        "assigned_to_name": None,
        "patient_id": t.patient_id,
        "patient_name": None,
        "source_type": t.source_type,
        "source_id": t.source_id,
        "delivery_channel": t.delivery_channel,
        "delivery_status": t.delivery_status,
        "delivery_recipient": t.delivery_recipient,
        "delivery_provider_message_id": t.delivery_provider_message_id,
        "delivery_error": t.delivery_error,
        "delivery_attempts": t.delivery_attempts,
        "delivered_at": t.delivered_at.isoformat() if t.delivered_at else None,
        "creator_id": t.creator_id,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
