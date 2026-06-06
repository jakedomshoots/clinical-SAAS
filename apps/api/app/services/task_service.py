from datetime import UTC, datetime, time

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.services.audit_service import log_event

RETRYABLE_DELIVERY_STATUSES = {"failed", "blocked"}
ACTIVE_TASK_STATUSES = [TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]


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


async def work_queue_summary(db: AsyncSession, user: User) -> dict:
    now = datetime.now(UTC).replace(tzinfo=None)
    today_end = datetime.combine(now.date(), time.max)
    rows = (
        await db.execute(
            select(Task, User.role)
            .outerjoin(User, Task.assigned_to_id == User.id)
            .where(
                Task.organization_id == user.organization_id,
                Task.status.in_(ACTIVE_TASK_STATUSES),
            )
        )
    ).all()
    tasks = [row[0] for row in rows]
    role_buckets: dict[str, dict] = {}
    source_buckets: dict[str, int] = {}
    for task, role in rows:
        role_key = role.value if role else "unassigned"
        bucket = role_buckets.setdefault(role_key, {"open_count": 0, "urgent_count": 0, "overdue_count": 0})
        bucket["open_count"] += 1
        if task.priority == TaskPriority.urgent:
            bucket["urgent_count"] += 1
        if task.due_date and task.due_date < now:
            bucket["overdue_count"] += 1
        source_key = _task_source_bucket(task.source_type)
        source_buckets[source_key] = source_buckets.get(source_key, 0) + 1

    urgent_count = sum(1 for task in tasks if task.priority == TaskPriority.urgent)
    high_priority_count = sum(1 for task in tasks if task.priority in {TaskPriority.high, TaskPriority.urgent})
    overdue_count = sum(1 for task in tasks if task.due_date and task.due_date < now)
    due_today_count = sum(1 for task in tasks if task.due_date and now <= task.due_date <= today_end)
    unassigned_count = sum(1 for task in tasks if not task.assigned_to_id)
    blocked_count = sum(1 for task in tasks if task.status == TaskStatus.blocked)
    return {
        "generated_at": now.isoformat(),
        "open_count": sum(1 for task in tasks if task.status == TaskStatus.open),
        "in_progress_count": sum(1 for task in tasks if task.status == TaskStatus.in_progress),
        "blocked_count": blocked_count,
        "urgent_count": urgent_count,
        "high_priority_count": high_priority_count,
        "overdue_count": overdue_count,
        "due_today_count": due_today_count,
        "unassigned_count": unassigned_count,
        "role_buckets": role_buckets,
        "source_buckets": source_buckets,
        "next_actions": _task_work_queue_actions(
            overdue_count,
            urgent_count,
            unassigned_count,
            due_today_count,
            blocked_count,
        ),
    }


async def create_task(db: AsyncSession, user: User, data: dict) -> dict | None:
    assigned_to_id = data.get("assigned_to_id")
    if assigned_to_id and not await _user_in_org(db, user, assigned_to_id):
        return None
    patient_id = data.get("patient_id")
    if patient_id and not await _patient_in_org(db, user, patient_id):
        return None
    task = Task(
        organization_id=user.organization_id,
        title=data["title"],
        description=data.get("description"),
        priority=TaskPriority(data.get("priority", "normal")),
        status=TaskStatus.open,
        due_date=data.get("due_date"),
        assigned_to_id=assigned_to_id,
        patient_id=patient_id,
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
    if "patient_id" in data and data["patient_id"] and not await _patient_in_org(
        db,
        user,
        data["patient_id"],
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
        "sms_consent": patient.sms_consent,
        "email_consent": patient.email_consent,
        "preferred_contact_channel": patient.preferred_contact_channel,
        "channel_options": [
            _channel_option(patient, "sms"),
            _channel_option(patient, "email"),
        ],
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
    option = _channel_option(draft, channel)
    is_eligible = bool(option["eligible"])
    task.delivery_status = "queued" if is_eligible else "blocked"
    task.delivery_recipient = recipient
    task.delivery_provider_message_id = f"pending-{task.id}" if is_eligible else None
    task.delivery_error = None if is_eligible else option["blocked_reason"]
    task.delivery_attempts = (task.delivery_attempts or 0) + 1
    task.delivery_payload = {
        "subject": data["subject"],
        "body": data["body"],
        "consent_required": True,
        "eligible": is_eligible,
        "blocked_reason": option["blocked_reason"],
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
            "blocked_reason": option["blocked_reason"],
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
        "eligible": is_eligible,
        "blocked_reason": option["blocked_reason"],
        "retryable": task.delivery_status in RETRYABLE_DELIVERY_STATUSES,
    }


async def outreach_summary(db: AsyncSession, user: User) -> dict:
    rows = (
        await db.execute(
            select(Task).where(
                Task.organization_id == user.organization_id,
                Task.delivery_status.is_not(None),
            )
        )
    ).scalars().all()
    return {
        "queued_count": sum(1 for task in rows if task.delivery_status == "queued"),
        "delivered_count": sum(1 for task in rows if task.delivery_status == "delivered"),
        "failed_count": sum(1 for task in rows if task.delivery_status == "failed"),
        "blocked_count": sum(1 for task in rows if task.delivery_status == "blocked"),
        "retryable_failed_count": sum(
            1 for task in rows if task.delivery_status in RETRYABLE_DELIVERY_STATUSES
        ),
        "consent_blocked_count": sum(
            1
            for task in rows
            if task.delivery_status == "blocked"
            and task.delivery_error
            and "consent" in task.delivery_error.lower()
        ),
        "no_contact_blocked_count": sum(
            1
            for task in rows
            if task.delivery_status == "blocked"
            and task.delivery_error
            and "recipient" in task.delivery_error.lower()
        ),
        "total_outreach_tasks": len(rows),
        "consent_required": True,
    }


async def apply_delivery_callback(
    db: AsyncSession,
    *,
    organization_id: str,
    provider_message_id: str,
    status: str,
    error: str | None = None,
) -> bool:
    task = (
        await db.execute(
            select(Task).where(
                Task.organization_id == organization_id,
                Task.delivery_provider_message_id == provider_message_id,
            )
        )
    ).scalar_one_or_none()
    if not task:
        return False
    task.delivery_status = status
    task.delivery_error = error
    if status == "delivered":
        from datetime import UTC, datetime

        task.delivered_at = datetime.now(UTC).replace(tzinfo=None)
    await db.commit()
    return True


def _channel_option(patient: Patient | dict, channel: str) -> dict:
    if channel == "sms":
        recipient = _get_value(patient, "phone", "patient_phone")
        consent = bool(_get_value(patient, "sms_consent", default=False))
    else:
        recipient = _get_value(patient, "email", "patient_email")
        consent = bool(_get_value(patient, "email_consent", default=False))
    if not recipient:
        return {
            "channel": channel,
            "recipient": None,
            "eligible": False,
            "blocked_reason": f"No {channel} recipient is available for this patient.",
        }
    if not consent:
        return {
            "channel": channel,
            "recipient": recipient,
            "eligible": False,
            "blocked_reason": f"Patient has not granted {channel} outreach consent.",
        }
    return {
        "channel": channel,
        "recipient": recipient,
        "eligible": True,
        "blocked_reason": None,
    }


def _get_value(source: Patient | dict, key: str, fallback: str | None = None, default=None):
    if isinstance(source, dict):
        if key in source:
            return source[key]
        if fallback and fallback in source:
            return source[fallback]
        return default
    return getattr(source, key, default)


def _task_source_bucket(source_type: str | None) -> str:
    if not source_type:
        return "manual"
    if source_type.startswith("checkout_handoff:"):
        return "checkout_handoff"
    return source_type


def _task_work_queue_actions(
    overdue_count: int,
    urgent_count: int,
    unassigned_count: int,
    due_today_count: int,
    blocked_count: int,
) -> list[dict]:
    actions = []
    if blocked_count:
        actions.append({
            "key": "blocked",
            "label": "Resolve blocked work",
            "detail": f"{blocked_count} task(s) are blocked.",
            "severity": "critical",
            "route": "/tasks",
        })
    if overdue_count:
        actions.append({
            "key": "overdue",
            "label": "Clear overdue work",
            "detail": f"{overdue_count} active task(s) are past due.",
            "severity": "critical",
            "route": "/tasks",
        })
    if urgent_count:
        actions.append({
            "key": "urgent",
            "label": "Review urgent work",
            "detail": f"{urgent_count} urgent task(s) need same-day ownership.",
            "severity": "critical",
            "route": "/tasks",
        })
    if unassigned_count:
        actions.append({
            "key": "unassigned",
            "label": "Assign open work",
            "detail": f"{unassigned_count} active task(s) have no owner.",
            "severity": "warning",
            "route": "/tasks",
        })
    if due_today_count:
        actions.append({
            "key": "due_today",
            "label": "Prepare today's queue",
            "detail": f"{due_today_count} task(s) are due today.",
            "severity": "warning",
            "route": "/tasks",
        })
    return actions


async def _user_in_org(db: AsyncSession, user: User, user_id: str) -> bool:
    result = await db.execute(
        select(User.id).where(
            User.id == user_id,
            User.organization_id == user.organization_id,
            User.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none() is not None


async def _patient_in_org(db: AsyncSession, user: User, patient_id: str) -> bool:
    result = await db.execute(
        select(Patient.id).where(
            Patient.id == patient_id,
            Patient.organization_id == user.organization_id,
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
