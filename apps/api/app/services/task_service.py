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


async def create_task(db: AsyncSession, user: User, data: dict) -> dict:
    task = Task(
        organization_id=user.organization_id,
        title=data["title"],
        description=data.get("description"),
        priority=TaskPriority(data.get("priority", "normal")),
        status=TaskStatus.open,
        due_date=data.get("due_date"),
        assigned_to_id=data.get("assigned_to_id"),
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
    old_status = task.status.value
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
    event_type = f"task.{task.status.value}" if old_status != task.status.value else "task.updated"
    await log_event(
        db,
        event_type,
        "task",
        task.id,
        actor_id=user.id,
        payload={"title": task.title, "status": task.status.value},
    )
    return await get_task(db, user, task.id)


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
        "creator_id": t.creator_id,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
