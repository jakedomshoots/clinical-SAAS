from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.task import Task, TaskPriority, TaskStatus
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
        upload_status=data.get("upload_status") or ("uploaded" if data.get("file_url") else "metadata_only"),
        ocr_status=data.get("ocr_status") or "not_started",
        classification=data.get("classification"),
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


async def prepare_document_upload(
    db: AsyncSession,
    user: User,
    patient_id: str,
    data: dict,
) -> dict | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    safe_filename = data["filename"].replace("/", "_").replace("\\", "_")
    object_key = f"patients/{patient_id}/documents/{datetime.now(UTC).strftime('%Y%m%dT%H%M%S')}-{safe_filename}"
    file_url = f"s3://concierge-os/{object_key}"
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=15)
    await log_event(
        db,
        "patient_document.upload_prepared",
        "patient",
        patient_id,
        actor_id=user.id,
        payload={
            "filename": safe_filename,
            "content_type": data["content_type"],
            "file_url": file_url,
        },
    )
    return {
        "upload_url": file_url,
        "file_url": file_url,
        "method": "PUT",
        "expires_at": expires_at.isoformat(),
        "headers": {"Content-Type": data["content_type"]},
    }


async def process_patient_document(
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

    document.upload_status = "uploaded" if document.file_url else "metadata_only"
    document.ocr_status = "completed" if document.file_url else "not_available"
    document.classification = _classify_document(document)
    if not document.summary:
        document.summary = _default_summary(document)

    created_task_id = None
    if document.status in {PatientDocumentStatus.received, PatientDocumentStatus.needs_review}:
        document.status = PatientDocumentStatus.needs_review
        existing_task = (
            await db.execute(
                select(Task.id).where(
                    Task.organization_id == user.organization_id,
                    Task.patient_id == patient_id,
                    Task.source_type == "document_processing",
                    Task.source_id == document.id,
                    Task.status.in_([TaskStatus.open, TaskStatus.in_progress]),
                )
            )
        ).scalar_one_or_none()
        if not existing_task:
            task = Task(
                organization_id=user.organization_id,
                title=f"Review {document.classification or document.document_type}: {document.title}",
                description=document.summary,
                priority=TaskPriority.high if document.classification == "lab_result" else TaskPriority.normal,
                status=TaskStatus.open,
                patient_id=patient_id,
                source_type="document_processing",
                source_id=document.id,
                creator_id=user.id,
            )
            db.add(task)
            await db.flush()
            created_task_id = task.id
        else:
            created_task_id = existing_task
    await db.commit()
    await db.refresh(document)
    await log_event(
        db,
        "patient_document.processed",
        "patient_document",
        document.id,
        actor_id=user.id,
        payload={
            "patient_id": patient_id,
            "classification": document.classification,
            "ocr_status": document.ocr_status,
            "created_task_id": created_task_id,
        },
    )
    return {
        "document": PatientDocumentOut.model_validate(document).model_dump(),
        "created_task_id": created_task_id,
    }


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
    reason: str,
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
    await log_event(
        db,
        "patient_document.accessed",
        "patient_document",
        document.id,
        actor_id=user.id,
        payload={
            "patient_id": patient_id,
            "reason": reason,
            "has_file": bool(document.file_url),
        },
    )
    if not document.file_url:
        return {
            "document_id": document.id,
            "available": False,
            "url": None,
            "expires_at": None,
            "reason": "No file URL is attached to this document yet.",
            "preview_supported": False,
            "content_type": None,
            "viewer_mode": "metadata",
        }
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=15)
    content_type = _infer_content_type(document.file_url)
    return {
        "document_id": document.id,
        "available": True,
        "url": document.file_url,
        "expires_at": expires_at.isoformat(),
        "reason": None,
        "preview_supported": content_type in {"application/pdf", "image/png", "image/jpeg"},
        "content_type": content_type,
        "viewer_mode": "inline" if content_type in {"application/pdf", "image/png", "image/jpeg"} else "download",
    }


def _infer_content_type(file_url: str) -> str:
    lower = file_url.lower()
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        return "image/jpeg"
    if lower.endswith(".txt"):
        return "text/plain"
    return "application/octet-stream"


def _classify_document(document: PatientDocument) -> str:
    text = " ".join(
        item.lower()
        for item in [document.title, document.document_type, document.source, document.summary or ""]
    )
    if "lab" in text or "cmp" in text or "cbc" in text:
        return "lab_result"
    if "consult" in text or "cardiology" in text or "referral" in text:
        return "consult_note"
    if "insurance" in text or "eligibility" in text:
        return "insurance"
    return "clinical_record"


def _default_summary(document: PatientDocument) -> str:
    if document.file_url:
        return f"{document.document_type} from {document.source} was processed and needs chart review."
    return f"{document.document_type} metadata from {document.source} is available without an attached file."
