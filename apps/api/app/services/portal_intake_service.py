from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.portal_intake import PortalIntakeStatus, PortalIntakeSubmission
from app.models.user import User
from app.services.audit_service import log_event
from app.services import patient_document_service, patient_service, schedule_service


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
    await log_event(
        db,
        "portal_intake.received",
        "portal_intake",
        submission.id,
        actor_id=user.id,
        organization_id=user.organization_id,
        payload={"patient_id": patient_id},
    )
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
    await log_event(
        db,
        f"portal_intake.{submission.status.value}",
        "portal_intake",
        submission.id,
        actor_id=user.id,
        organization_id=user.organization_id,
        payload={"updated_fields": list(data.keys())},
    )
    return submission


async def apply_to_patient(db: AsyncSession, user: User, submission_id: str) -> PortalIntakeSubmission | None:
    submission = await _get_submission(db, user, submission_id)
    if not submission or not submission.patient_id:
        return submission
    payload = submission.submitted_payload or {}
    update = {
        key: payload[key]
        for key in ("phone", "email", "address", "emergency_contact", "insurance", "allergies", "problem_list")
        if key in payload
    }
    if update:
        await patient_service.update_patient(db, user, submission.patient_id, update)
    return await update_submission(db, user, submission_id, {"status": PortalIntakeStatus.applied.value})


async def convert_to_appointment(db: AsyncSession, user: User, submission_id: str) -> dict | None:
    submission = await _get_submission(db, user, submission_id)
    if not submission or not submission.patient_id:
        return None
    payload = submission.submitted_payload or {}
    start_time = payload["start_time"]
    end_time = payload["end_time"]
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time)
    if isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time)
    appointment = await schedule_service.create_appointment(db, user, {
        "patient_id": submission.patient_id,
        "provider_id": payload["provider_id"],
        "start_time": start_time,
        "end_time": end_time,
        "type": payload.get("type", "Portal request"),
        "notes": payload.get("notes"),
    })
    await update_submission(db, user, submission_id, {"status": PortalIntakeStatus.applied.value})
    return appointment


async def convert_to_document(db: AsyncSession, user: User, submission_id: str) -> dict | None:
    submission = await _get_submission(db, user, submission_id)
    if not submission or not submission.patient_id:
        return None
    payload = submission.submitted_payload or {}
    document = await patient_document_service.create_patient_document(db, user, submission.patient_id, {
        "title": payload.get("title", "Portal uploaded document"),
        "source": "Patient portal",
        "document_type": payload.get("document_type", "Patient upload"),
        "status": "needs_review",
        "matched_by": "portal intake",
        "pages": payload.get("pages", 1),
        "file_url": payload.get("file_url"),
        "summary": payload.get("summary", "Patient submitted document from portal intake."),
    })
    await update_submission(db, user, submission_id, {"status": PortalIntakeStatus.applied.value})
    return document


async def _get_submission(db: AsyncSession, user: User, submission_id: str) -> PortalIntakeSubmission | None:
    return (await db.execute(
        select(PortalIntakeSubmission).where(
            PortalIntakeSubmission.id == submission_id,
            PortalIntakeSubmission.organization_id == user.organization_id,
        )
    )).scalar_one_or_none()
