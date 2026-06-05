from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.user import User
from app.schemas.patient_document import PatientDocumentOut
from app.services.audit_service import log_event


async def _patient_exists(db: AsyncSession, user: User, patient_id: str) -> bool:
    patient = (
        await db.execute(
            select(Patient.id).where(
                Patient.id == patient_id,
                Patient.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    return patient is not None


async def list_patient_documents(
    db: AsyncSession,
    user: User,
    patient_id: str,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
) -> tuple[list[dict], int] | None:
    if not await _patient_exists(db, user, patient_id):
        return None

    query = select(PatientDocument).where(
        PatientDocument.organization_id == user.organization_id,
        PatientDocument.patient_id == patient_id,
    )
    count_query = select(func.count(PatientDocument.id)).where(
        PatientDocument.organization_id == user.organization_id,
        PatientDocument.patient_id == patient_id,
    )

    if status:
        document_status = PatientDocumentStatus(status)
        query = query.where(PatientDocument.status == document_status)
        count_query = count_query.where(PatientDocument.status == document_status)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(PatientDocument.received_at.desc()).offset(offset).limit(page_size)
    )
    documents = result.scalars().all()
    return [PatientDocumentOut.model_validate(doc).model_dump() for doc in documents], total


async def create_patient_document(
    db: AsyncSession,
    user: User,
    patient_id: str,
    data: dict,
) -> dict | None:
    if not await _patient_exists(db, user, patient_id):
        return None

    document = PatientDocument(
        organization_id=user.organization_id,
        patient_id=patient_id,
        title=data["title"],
        source=data["source"],
        document_type=data["document_type"],
        status=PatientDocumentStatus(data.get("status") or PatientDocumentStatus.received.value),
        matched_by=data.get("matched_by"),
        pages=data.get("pages", 1),
        file_url=data.get("file_url"),
        summary=data.get("summary"),
        received_at=data.get("received_at") or datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    await log_event(
        db,
        "patient_document.created",
        "patient_document",
        document.id,
        actor_id=user.id,
        payload={
            "patient_id": patient_id,
            "title": document.title,
            "source": document.source,
            "status": document.status.value,
        },
    )
    return PatientDocumentOut.model_validate(document).model_dump()


async def update_patient_document(
    db: AsyncSession,
    user: User,
    patient_id: str,
    document_id: str,
    data: dict,
) -> dict | None:
    result = await db.execute(
        select(PatientDocument).where(
            PatientDocument.id == document_id,
            PatientDocument.patient_id == patient_id,
            PatientDocument.organization_id == user.organization_id,
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        return None

    for field, value in data.items():
        if field == "status" and value is not None:
            document.status = PatientDocumentStatus(value)
        elif hasattr(document, field):
            setattr(document, field, value)

    await db.commit()
    await db.refresh(document)

    await log_event(
        db,
        "patient_document.updated",
        "patient_document",
        document.id,
        actor_id=user.id,
        payload={"patient_id": patient_id, "updated_fields": list(data.keys())},
    )
    return PatientDocumentOut.model_validate(document).model_dump()


async def get_document_access(
    db: AsyncSession,
    user: User,
    patient_id: str,
    document_id: str,
) -> dict | None:
    document = (
        await db.execute(
            select(PatientDocument).where(
                PatientDocument.id == document_id,
                PatientDocument.patient_id == patient_id,
                PatientDocument.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not document:
        return None
    if not document.file_url:
        return {
            "document_id": document.id,
            "available": False,
            "url": None,
            "expires_at": None,
            "reason": "No file URL is attached to this document yet.",
        }
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=15)
    return {
        "document_id": document.id,
        "available": True,
        "url": document.file_url,
        "expires_at": expires_at.isoformat(),
        "reason": None,
    }
