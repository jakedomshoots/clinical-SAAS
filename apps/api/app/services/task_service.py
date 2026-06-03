from datetime import datetime
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.services.audit_service import log_event


def _task_to_dict(task: Task, assigned_name: str | None = None, patient_name: str | None = None) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "priority": task.priority.value,
        "status": task.status.value,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "assigned_to_id": task.assigned_to_id,
        "assigned_to_name": assigned_name,
        "patient_id": task.patient_id,
        "patient_name": patient_name,
        "creator_id": task.creator_id,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }


async def list_tasks(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    priority: str | None = None,
    assigned_to_id: str | None = None,
    patient_id: str | None = None,
    search: str | None = None,
) -> tuple[list[dict], int]:
    from app.models.patient import Patient

    query = select(Task)
    countq = select(func.count(Task.id))

    if status:
        task_status = TaskStatus(status)
        query = query.where(Task.status == task_status)
        countq = countq.where(Task.status == task_status)
    if priority:
        task_priority = TaskPriority(priority)
        query = query.where(Task.priority == task_priority)
        countq = countq.where(Task.priority == task_priority)
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
    query = query.order_by(Task.priority.desc(), Task.due_date.asc().nulls_last(), Task.created_at.desc())
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    tasks = result.scalars().all()

    user_ids = {t.assigned_to_id for t in tasks if t.assigned_to_id}
    patient_ids = {t.patient_id for t in tasks if t.patient_id}

    user_map: dict[str, str] = {}
    if user_ids:
        user_results = await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids)))
        user_map = {r.id: r.display_name for r in user_results}

    patient_map: dict[str, str] = {}
    if patient_ids:
        pat_results = await db.execute(select(Patient.id, Patient.first_name, Patient.last_name).where(Patient.id.in_(patient_ids)))
        patient_map = {r.id: f"{r.last_name}, {r.first_name}" for r in pat_results}

    return [
        _task_to_dict(t, user_map.get(t.assigned_to_id), patient_map.get(t.patient_id))
        for t in tasks
    ], total


async def get_task(db: AsyncSession, task_id: str) -> dict | None:
    from app.models.patient import Patient

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        return None

    assigned_name = None
    patient_name = None
    if task.assigned_to_id:
        u = await db.get(User, task.assigned_to_id)
        assigned_name = u.display_name if u else None
    if task.patient_id:
        p = await db.get(Patient, task.patient_id)
        patient_name = f"{p.last_name}, {p.first_name}" if p else None

    return _task_to_dict(task, assigned_name, patient_name)


async def create_task(db: AsyncSession, user: User, data: dict) -> dict:
    task = Task(
        title=data["title"],
        description=data.get("description"),
        priority=TaskPriority(data.get("priority", "normal")),
        status=TaskStatus.open,
        due_date=data.get("due_date"),
        assigned_to_id=data.get("assigned_to_id"),
        patient_id=data.get("patient_id"),
        creator_id=user.id,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await log_event(db, "task.created", "task", task.id, actor_id=user.id, payload={"title": task.title})
    return await get_task(db, task.id)


async def update_task(db: AsyncSession, user: User, task_id: str, data: dict) -> dict | None:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        return None

    old_status = task.status.value
    for field, value in data.items():
        if value is not None and hasattr(task, field):
            if field == "priority":
                setattr(task, field, TaskPriority(value))
            elif field == "status":
                setattr(task, field, TaskStatus(value))
            else:
                setattr(task, field, value)

    await db.commit()
    await db.refresh(task)

    new_status = task.status.value
    event_type = f"task.{new_status}" if old_status != new_status else "task.updated"

    await log_event(db, event_type, "task", task.id, actor_id=user.id, payload={"title": task.title, "status": new_status})
    return await get_task(db, task.id)
