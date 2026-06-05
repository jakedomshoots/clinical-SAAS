from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fax import Fax
from app.models.message import Message
from app.models.patient import Patient
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.services import fax_service, message_service, task_service
from app.services.audit_service import log_event


def _default_due_date() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=4)


async def create_follow_up_task(db: AsyncSession, user: User, data: dict) -> dict:
    patient_name = None
    if data.get("patient_id"):
        patient = (
            await db.execute(
                select(Patient).where(
                    Patient.id == data["patient_id"],
                    Patient.organization_id == user.organization_id,
                )
            )
        ).scalar_one_or_none()
        if not patient:
            return {}
        patient_name = f"{patient.first_name} {patient.last_name}" if patient else None

    task = Task(
        organization_id=user.organization_id,
        title=data.get("title") or f"Assistant follow-up: {patient_name or data['context']}",
        description=(
            f"Assistant staged this from: {data['context']}. "
            "Confirm chart context before outreach."
        ),
        priority=TaskPriority(data.get("priority", "high")),
        status=TaskStatus.open,
        due_date=data.get("due_date") or _default_due_date(),
        patient_id=data.get("patient_id"),
        creator_id=user.id,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await log_event(
        db,
        "assistant.task_created",
        "task",
        task.id,
        actor_id=user.id,
        payload={"context": data["context"], "patient_id": task.patient_id},
    )
    return await task_service.get_task(db, user, task.id)


async def draft_portal_reply(db: AsyncSession, user: User, data: dict) -> dict:
    recipient = (
        await db.execute(
            select(User).where(
                User.id == data["recipient_id"],
                User.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not recipient:
        return {}

    message = Message(
        organization_id=user.organization_id,
        sender_id=user.id,
        recipient_id=data["recipient_id"],
        subject=data["subject"],
        body=data["body"],
        thread_id=data.get("thread_id") or None,
        is_read=True,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    if message.thread_id is None:
        message.thread_id = message.id
        await db.commit()
        await db.refresh(message)
    await log_event(
        db,
        "assistant.message_drafted",
        "message",
        message.id,
        actor_id=user.id,
        payload={"context": data["context"], "subject": message.subject},
    )
    return await message_service.get_message(db, user, message.id)


async def stage_fax_match(db: AsyncSession, user: User, data: dict) -> dict | None:
    result = await db.execute(
        select(Fax).where(
            Fax.id == data["fax_id"],
            Fax.organization_id == user.organization_id,
        )
    )
    fax = result.scalar_one_or_none()
    if not fax:
        return None
    patient = (
        await db.execute(
            select(Patient.id).where(
                Patient.id == data["patient_id"],
                Patient.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not patient:
        return None

    fax.patient_id = data["patient_id"]
    fax.matched_by = "assistant suggested, user confirmed"
    await db.commit()
    await db.refresh(fax)
    await log_event(
        db,
        "assistant.fax_match_staged",
        "fax",
        fax.id,
        actor_id=user.id,
        payload={"context": data["context"], "patient_id": data["patient_id"]},
    )
    return await fax_service.get_fax(db, user, fax.id)
