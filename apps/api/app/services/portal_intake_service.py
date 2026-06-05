from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.portal_intake import PortalIntakeStatus, PortalIntakeSubmission
from app.models.user import User
from app.services.audit_service import log_event


async def list_submissions(db: AsyncSession, user: User) -> tuple[list[PortalIntakeSubmission], int]:
    query = select(PortalIntakeSubmission).where(PortalIntakeSubmission.organization_id == user.organization_id)
    countq = select(func.count(PortalIntakeSubmission.id)).where(PortalIntakeSubmission.organization_id == user.organization_id)
    total = (await db.execute(countq)).scalar() or 0
    result = await db.execute(query.order_by(PortalIntakeSubmission.created_at.desc()).limit(100))
    return list(result.scalars().all()), total


async def create_submission(db: AsyncSession, user: User, data: dict) -> PortalIntakeSubmission | None:
    patient_id = data.get("patient_id")
    if patient_id:
        exists = (await db.execute(select(Patient.id).where(Patient.id == patient_id, Patient.organization_id == user.organization_id))).scalar_one_or_none()
        if not exists:
            return None
    submission = PortalIntakeSubmission(organization_id=user.organization_id, **data)
    db.add(submission)
    await db.commit()
    await db.refresh(submission)
    await log_event(db, "portal_intake.received", "portal_intake", submission.id, actor_id=user.id, payload={"patient_id": patient_id})
    return submission


async def update_submission(db: AsyncSession, user: User, submission_id: str, data: dict) -> PortalIntakeSubmission | None:
    submission = (await db.execute(select(PortalIntakeSubmission).where(PortalIntakeSubmission.id == submission_id, PortalIntakeSubmission.organization_id == user.organization_id))).scalar_one_or_none()
    if not submission:
        return None
    for field, value in data.items():
        if hasattr(submission, field) and value is not None:
            setattr(submission, field, PortalIntakeStatus(value) if field == "status" else value)
    await db.commit()
    await db.refresh(submission)
    await log_event(db, f"portal_intake.{submission.status.value}", "portal_intake", submission.id, actor_id=user.id, payload={"updated_fields": list(data.keys())})
    return submission
