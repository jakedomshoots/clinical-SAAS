from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient_clinical import CarePlanStatus, PatientCarePlanItem
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.workload import WorkloadBucketOut, WorkloadSummaryOut


async def checkout_workload(db: AsyncSession, user: User) -> WorkloadSummaryOut:
    rows = (
        (
            await db.execute(
                select(PatientCarePlanItem).where(
                    PatientCarePlanItem.organization_id == user.organization_id,
                    PatientCarePlanItem.status.in_(
                        [CarePlanStatus.open, CarePlanStatus.in_progress, CarePlanStatus.blocked]
                    ),
                )
            )
        )
        .scalars()
        .all()
    )
    task_rows = (
        (
            await db.execute(
                select(Task).where(
                    Task.organization_id == user.organization_id,
                    Task.source_type.like("checkout_handoff:%"),
                    Task.status.in_([TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]),
                )
            )
        )
        .scalars()
        .all()
    )
    user_ids = {item.assigned_to_id for item in rows if item.assigned_to_id}
    user_ids.update(task.assigned_to_id for task in task_rows if task.assigned_to_id)
    user_map = {}
    if user_ids:
        users = await db.execute(
            select(User.id, User.display_name).where(
                User.id.in_(user_ids),
                User.organization_id == user.organization_id,
            )
        )
        user_map = {item.id: item.display_name for item in users}

    buckets: dict[tuple[str, str | None], dict] = {}
    for item in rows:
        key = (item.owner_role, item.assigned_to_id)
        bucket = buckets.setdefault(
            key,
            {
                "owner_role": item.owner_role,
                "assigned_to_id": item.assigned_to_id,
                "assigned_to_name": user_map.get(item.assigned_to_id),
                "open_items": 0,
                "blocked_items": 0,
                "escalated_items": 0,
                "source_linked_tasks": 0,
                "urgent_tasks": 0,
            },
        )
        bucket["open_items"] += 1
        if item.status == CarePlanStatus.blocked:
            bucket["blocked_items"] += 1
        if item.escalation:
            bucket["escalated_items"] += 1

    for task in task_rows:
        key = ("Checkout tasks", task.assigned_to_id)
        bucket = buckets.setdefault(
            key,
            {
                "owner_role": "Checkout tasks",
                "assigned_to_id": task.assigned_to_id,
                "assigned_to_name": user_map.get(task.assigned_to_id),
                "open_items": 0,
                "blocked_items": 0,
                "escalated_items": 0,
                "source_linked_tasks": 0,
                "urgent_tasks": 0,
            },
        )
        bucket["source_linked_tasks"] += 1
        if task.priority == TaskPriority.urgent:
            bucket["urgent_tasks"] += 1

    return WorkloadSummaryOut(
        data=[
            WorkloadBucketOut(**bucket)
            for bucket in sorted(
                buckets.values(),
                key=lambda item: (item["owner_role"], item["assigned_to_name"] or ""),
            )
        ],
        total_open_items=len(rows),
        unassigned_items=sum(1 for item in rows if not item.assigned_to_id),
        source_linked_tasks=len(task_rows),
        urgent_tasks=sum(1 for task in task_rows if task.priority == TaskPriority.urgent),
    )
