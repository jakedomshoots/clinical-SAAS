import base64
import binascii
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta

from minio.error import S3Error
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from urllib3.exceptions import HTTPError

from app.config import settings
from app.minio_client import minio
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


def _patient_document_prefix(patient_id: str) -> str:
    return f"patients/{patient_id}/documents/"


def _validated_patient_storage_location(file_url: str, patient_id: str) -> tuple[str, str]:
    parsed = _parse_s3_url(file_url)
    if not parsed:
        raise ValueError("Document file URL must reference object storage")
    bucket, object_key = parsed
    if bucket != settings.minio_bucket or not object_key.startswith(
        _patient_document_prefix(patient_id)
    ):
        raise ValueError(
            "Document file URL must reference the prepared patient document upload path"
        )
    path_parts = object_key.split("/")
    if any(part in {"", ".", ".."} for part in path_parts):
        raise ValueError("Document file URL contains an invalid storage path")
    return bucket, object_key


def _document_upload_verification_required() -> bool:
    return settings.is_production or settings.document_upload_verification_required


def _verify_uploaded_object(
    file_url: str,
    patient_id: str,
    content_type: str,
    checksum: str | None,
) -> None:
    bucket, object_key = _validated_patient_storage_location(file_url, patient_id)
    if not _document_upload_verification_required():
        return
    try:
        stat = minio.stat_object(bucket, object_key)
    except (HTTPError, S3Error) as exc:
        raise ValueError("Uploaded object was not found in object storage") from exc

    recorded_content_type = getattr(stat, "content_type", None)
    if recorded_content_type and recorded_content_type != content_type:
        raise ValueError("Uploaded object content type does not match the prepared upload")

    metadata = getattr(stat, "metadata", {}) or {}
    recorded_checksum = (
        metadata.get("checksum")
        or metadata.get("x-amz-meta-checksum")
        or metadata.get("X-Amz-Meta-Checksum")
    )
    if checksum and recorded_checksum and not hmac.compare_digest(str(recorded_checksum), checksum):
        raise ValueError("Uploaded object checksum does not match the confirmation payload")


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


async def document_review_queue(
    db: AsyncSession,
    user: User,
    page: int = 1,
    page_size: int = 20,
    status: str | None = PatientDocumentStatus.needs_review.value,
    routed_to_role: str | None = None,
    review_priority: str | None = None,
) -> tuple[list[dict], int]:
    filters = [
        PatientDocument.organization_id == user.organization_id,
        Patient.organization_id == user.organization_id,
        PatientDocument.patient_id == Patient.id,
    ]
    if status:
        filters.append(PatientDocument.status == PatientDocumentStatus(status))
    if routed_to_role:
        filters.append(PatientDocument.routed_to_role == routed_to_role)
    if review_priority:
        filters.append(PatientDocument.review_priority == review_priority)

    count_query = (
        select(func.count(PatientDocument.id)).select_from(PatientDocument, Patient).where(*filters)
    )
    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(
        select(PatientDocument, Patient)
        .where(*filters)
        .order_by(PatientDocument.received_at.desc(), PatientDocument.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = []
    for document, patient in result.all():
        rows.append(
            {
                **PatientDocumentOut.model_validate(document).model_dump(),
                "patient_name": f"{patient.first_name} {patient.last_name}",
                "patient_mrn": patient.mrn,
                "patient_dob": patient.dob,
                "patient_phone": patient.phone,
            }
        )
    return rows, total


async def create_patient_document(
    db: AsyncSession,
    user: User,
    patient_id: str,
    data: dict,
) -> dict | None:
    if not await _patient_exists(db, user, patient_id):
        return None

    file_url = data.get("file_url")
    if file_url:
        _validated_patient_storage_location(file_url, patient_id)

    document = PatientDocument(
        organization_id=user.organization_id,
        patient_id=patient_id,
        title=data["title"],
        source=data["source"],
        document_type=data["document_type"],
        status=PatientDocumentStatus(data.get("status") or PatientDocumentStatus.received.value),
        matched_by=data.get("matched_by"),
        source_contact=data.get("source_contact"),
        source_phone=data.get("source_phone"),
        source_fax=data.get("source_fax"),
        source_reference=data.get("source_reference"),
        requested_by=data.get("requested_by"),
        routed_to_role=data.get("routed_to_role"),
        review_priority=data.get("review_priority") or "normal",
        review_note=data.get("review_note"),
        reviewed_by=data.get("reviewed_by"),
        reviewed_at=data.get("reviewed_at"),
        pages=data.get("pages", 1),
        file_url=file_url,
        upload_status=data.get("upload_status")
        or ("uploaded" if data.get("file_url") else "metadata_only"),
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
        organization_id=user.organization_id,
        payload={
            "patient_id": patient_id,
            "title": document.title,
            "source": document.source,
            "status": document.status.value,
            "routed_to_role": document.routed_to_role,
            "review_priority": document.review_priority,
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
    file_url = f"s3://{settings.minio_bucket}/{object_key}"
    upload_url = _presigned_put_url(file_url, patient_id) or file_url
    expires_ts = int((datetime.now(UTC) + timedelta(minutes=15)).timestamp())
    expires_at = datetime.fromtimestamp(expires_ts, tz=UTC).replace(tzinfo=None)
    upload_token = _make_upload_token(patient_id, file_url, data["content_type"], expires_at)
    await log_event(
        db,
        "patient_document.upload_prepared",
        "patient",
        patient_id,
        actor_id=user.id,
        organization_id=user.organization_id,
        payload={
            "filename": safe_filename,
            "content_type": data["content_type"],
            "file_url": file_url,
        },
    )
    return {
        "upload_url": upload_url,
        "file_url": file_url,
        "upload_token": upload_token,
        "method": "PUT",
        "expires_at": expires_at.isoformat(),
        "headers": {"Content-Type": data["content_type"]},
    }


async def confirm_document_upload(
    db: AsyncSession,
    user: User,
    patient_id: str,
    data: dict,
) -> dict | None:
    if not _verify_upload_token(
        data.get("upload_token", ""),
        patient_id,
        data["file_url"],
        data["content_type"],
    ):
        raise ValueError("Upload confirmation does not match a prepared upload")

    checksum = data.get("checksum")
    _verify_uploaded_object(data["file_url"], patient_id, data["content_type"], checksum)
    duplicate = None
    if checksum:
        duplicate = (
            await db.execute(
                select(PatientDocument).where(
                    PatientDocument.organization_id == user.organization_id,
                    PatientDocument.patient_id == patient_id,
                    PatientDocument.summary.contains(checksum),
                )
            )
        ).scalar_one_or_none()
    if not duplicate:
        duplicate = (
            await db.execute(
                select(PatientDocument).where(
                    PatientDocument.organization_id == user.organization_id,
                    PatientDocument.patient_id == patient_id,
                    PatientDocument.file_url == data["file_url"],
                )
            )
        ).scalar_one_or_none()
    if duplicate:
        await log_event(
            db,
            "patient_document.upload_duplicate_detected",
            "patient_document",
            duplicate.id,
            actor_id=user.id,
            organization_id=user.organization_id,
            payload={
                "patient_id": patient_id,
                "file_url": data["file_url"],
                "filename": data["filename"],
                "checksum": checksum,
            },
        )
        return PatientDocumentOut.model_validate(duplicate).model_dump()
    document = await create_patient_document(
        db,
        user,
        patient_id,
        {
            "title": data["title"],
            "source": data["source"],
            "document_type": data["document_type"],
            "status": PatientDocumentStatus.needs_review.value,
            "matched_by": "upload confirmation",
            "review_priority": "normal",
            "pages": data.get("pages", 1),
            "file_url": data["file_url"],
            "upload_status": "uploaded",
            "ocr_status": "queued",
            "summary": f"Uploaded {data['filename']} ({data['content_type']}). Checksum: {checksum or 'not provided'}.",
        },
    )
    if not document:
        return None
    await log_event(
        db,
        "patient_document.upload_confirmed",
        "patient_document",
        document["id"],
        actor_id=user.id,
        organization_id=user.organization_id,
        payload={
            "patient_id": patient_id,
            "file_url": data["file_url"],
            "filename": data["filename"],
            "content_type": data["content_type"],
            "checksum": data.get("checksum"),
        },
    )
    return document


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
                    Task.status.in_([TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]),
                )
            )
        ).scalar_one_or_none()
        if not existing_task:
            task = Task(
                organization_id=user.organization_id,
                title=f"Review {document.classification or document.document_type}: {document.title}",
                description=document.summary,
                priority=TaskPriority.high
                if document.classification == "lab_result"
                else TaskPriority.normal,
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
        organization_id=user.organization_id,
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

    if "file_url" in data and data["file_url"]:
        _validated_patient_storage_location(data["file_url"], patient_id)

    for field, value in data.items():
        if field == "status" and value is not None:
            document.status = PatientDocumentStatus(value)
        elif hasattr(document, field):
            setattr(document, field, value)
    if (data.get("reviewed_by") or data.get("review_note")) and not document.reviewed_at:
        document.reviewed_at = datetime.now(UTC).replace(tzinfo=None)

    await db.commit()
    await db.refresh(document)

    await log_event(
        db,
        "patient_document.updated",
        "patient_document",
        document.id,
        actor_id=user.id,
        organization_id=user.organization_id,
        payload={
            "patient_id": patient_id,
            "updated_fields": list(data.keys()),
            "status": document.status.value,
            "reviewed_by": document.reviewed_by,
        },
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
    if not document.file_url:
        await log_event(
            db,
            "patient_document.accessed",
            "patient_document",
            document.id,
            actor_id=user.id,
            organization_id=user.organization_id,
            payload={
                "patient_id": patient_id,
                "reason": reason,
                "has_file": False,
                "storage_status": "metadata_only",
            },
        )
        return {
            "document_id": document.id,
            "available": False,
            "url": None,
            "expires_at": None,
            "reason": "No file URL is attached to this document yet.",
            "preview_supported": False,
            "content_type": None,
            "viewer_mode": "metadata",
            "access_token": None,
            "storage_status": "metadata_only",
            "file_name": None,
            "source_uri_preview": None,
        }
    expires_ts = int((datetime.now(UTC) + timedelta(minutes=15)).timestamp())
    expires_at = datetime.fromtimestamp(expires_ts, tz=UTC).replace(tzinfo=None)
    try:
        _validated_patient_storage_location(document.file_url, patient_id)
    except ValueError:
        await log_event(
            db,
            "patient_document.accessed",
            "patient_document",
            document.id,
            actor_id=user.id,
            organization_id=user.organization_id,
            payload={
                "patient_id": patient_id,
                "reason": reason,
                "has_file": True,
                "storage_status": "invalid_storage_reference",
            },
        )
        return {
            "document_id": document.id,
            "available": False,
            "url": None,
            "expires_at": None,
            "reason": "Document storage reference is invalid.",
            "preview_supported": False,
            "content_type": None,
            "viewer_mode": "metadata",
            "access_token": None,
            "storage_status": "invalid_storage_reference",
            "file_name": _file_name(document.file_url),
            "source_uri_preview": _storage_uri_preview(document.file_url),
        }
    content_type = _infer_content_type(document.file_url)
    viewer_mode = (
        "inline" if content_type in {"application/pdf", "image/png", "image/jpeg"} else "download"
    )
    access_token = _make_document_access_token(
        patient_id,
        document.id,
        document.file_url,
        expires_ts,
    )
    access_url = (
        f"/api/patients/{patient_id}/documents/{document.id}/download" f"?token={access_token}"
    )
    await log_event(
        db,
        "patient_document.accessed",
        "patient_document",
        document.id,
        actor_id=user.id,
        organization_id=user.organization_id,
        payload={
            "patient_id": patient_id,
            "reason": reason,
            "has_file": True,
            "storage_status": "signed_handoff",
            "viewer_mode": viewer_mode,
            "content_type": content_type,
            "expires_at": expires_at.isoformat(),
        },
    )
    return {
        "document_id": document.id,
        "available": True,
        "url": access_url,
        "expires_at": expires_at.isoformat(),
        "reason": None,
        "preview_supported": content_type in {"application/pdf", "image/png", "image/jpeg"},
        "content_type": content_type,
        "viewer_mode": viewer_mode,
        "access_token": access_token,
        "storage_status": "signed_handoff",
        "file_name": _file_name(document.file_url),
        "source_uri_preview": _storage_uri_preview(document.file_url),
    }


async def get_document_download_handoff(
    db: AsyncSession,
    user: User,
    patient_id: str,
    document_id: str,
    token: str,
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
    if not document or not document.file_url:
        return None
    if not _verify_document_access_token(token, patient_id, document_id, document.file_url):
        return None
    try:
        _validated_patient_storage_location(document.file_url, patient_id)
    except ValueError:
        return None
    content_type = _infer_content_type(document.file_url)
    presigned_url = _presigned_get_url(document.file_url, patient_id)
    expires_at = _document_access_token_expires_at(token)
    await log_event(
        db,
        "patient_document.download_handoff",
        "patient_document",
        document.id,
        actor_id=user.id,
        organization_id=user.organization_id,
        payload={
            "patient_id": patient_id,
            "storage_status": "signed_handoff",
            "viewer_mode": (
                "inline"
                if content_type in {"application/pdf", "image/png", "image/jpeg"}
                else "download"
            ),
            "content_type": content_type,
            "presigned": bool(presigned_url),
            "expires_at": expires_at.isoformat() if expires_at else None,
        },
    )
    return {
        "document_id": document.id,
        "title": document.title,
        "file_name": _file_name(document.file_url),
        "content_type": content_type,
        "viewer_mode": (
            "inline"
            if content_type in {"application/pdf", "image/png", "image/jpeg"}
            else "download"
        ),
        "storage_status": "signed_handoff",
        "source_uri_preview": _storage_uri_preview(document.file_url),
        "presigned_url": presigned_url,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "message": (
            "Signed object-storage access is ready."
            if presigned_url
            else "Signed document access is prepared. Configure object-storage signing to stream or redirect the file."
        ),
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


def _file_name(file_url: str) -> str:
    return file_url.rstrip("/").rsplit("/", 1)[-1] or "document"


def _storage_uri_preview(file_url: str) -> str:
    if file_url.startswith("s3://"):
        parts = file_url.removeprefix("s3://").split("/", 1)
        bucket = parts[0]
        path = parts[1] if len(parts) > 1 else ""
        return f"s3://{bucket}/.../{_file_name(path)}" if path else f"s3://{bucket}/..."
    if len(file_url) <= 80:
        return file_url
    return f"{file_url[:42]}...{file_url[-24:]}"


def _parse_s3_url(file_url: str) -> tuple[str, str] | None:
    if not file_url.startswith("s3://"):
        return None
    bucket_and_key = file_url.removeprefix("s3://").split("/", 1)
    if len(bucket_and_key) != 2 or not bucket_and_key[0] or not bucket_and_key[1]:
        return None
    return bucket_and_key[0], bucket_and_key[1]


def _presigned_get_url(file_url: str, patient_id: str) -> str | None:
    try:
        bucket, object_key = _validated_patient_storage_location(file_url, patient_id)
    except ValueError:
        return None
    try:
        return minio.presigned_get_object(
            bucket,
            object_key,
            expires=timedelta(minutes=15),
        )
    except (HTTPError, S3Error):
        return None


def _presigned_put_url(file_url: str, patient_id: str) -> str | None:
    try:
        bucket, object_key = _validated_patient_storage_location(file_url, patient_id)
    except ValueError:
        return None
    try:
        return minio.presigned_put_object(
            bucket,
            object_key,
            expires=timedelta(minutes=15),
        )
    except (HTTPError, S3Error):
        return None


def _document_access_token_message(
    patient_id: str,
    document_id: str,
    file_url: str,
    expires_at: int,
) -> str:
    return json.dumps(
        {
            "patient_id": patient_id,
            "document_id": document_id,
            "file_url": file_url,
            "expires_at": expires_at,
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def _make_document_access_token(
    patient_id: str,
    document_id: str,
    file_url: str,
    expires_at: int,
) -> str:
    message = _document_access_token_message(patient_id, document_id, file_url, expires_at)
    payload = {
        "patient_id": patient_id,
        "document_id": document_id,
        "file_url": file_url,
        "expires_at": expires_at,
        "sig": _sign_upload_token(message),
    }
    return base64.urlsafe_b64encode(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")


def _verify_document_access_token(
    token: str,
    patient_id: str,
    document_id: str,
    file_url: str,
) -> bool:
    try:
        payload = json.loads(base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8"))
        expires_at = int(payload["expires_at"])
        token_patient_id = str(payload["patient_id"])
        token_document_id = str(payload["document_id"])
        token_file_url = str(payload["file_url"])
        signature = str(payload["sig"])
    except (binascii.Error, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return False
    if expires_at < int(datetime.now(UTC).timestamp()):
        return False
    if (
        token_patient_id != patient_id
        or token_document_id != document_id
        or token_file_url != file_url
    ):
        return False
    message = _document_access_token_message(patient_id, document_id, file_url, expires_at)
    return hmac.compare_digest(signature, _sign_upload_token(message))


def _document_access_token_expires_at(token: str) -> datetime | None:
    try:
        payload = json.loads(base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8"))
        expires_at = int(payload["expires_at"])
    except (binascii.Error, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None
    return datetime.fromtimestamp(expires_at, tz=UTC).replace(tzinfo=None)


def _upload_token_message(
    patient_id: str,
    file_url: str,
    content_type: str,
    expires_at: int,
) -> str:
    return json.dumps(
        {
            "patient_id": patient_id,
            "file_url": file_url,
            "content_type": content_type,
            "expires_at": expires_at,
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def _sign_upload_token(message: str) -> str:
    return hmac.new(
        settings.secret_key.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _make_upload_token(
    patient_id: str,
    file_url: str,
    content_type: str,
    expires_at: datetime,
) -> str:
    expires_ts = int(expires_at.replace(tzinfo=UTC).timestamp())
    message = _upload_token_message(patient_id, file_url, content_type, expires_ts)
    payload = {
        "patient_id": patient_id,
        "file_url": file_url,
        "content_type": content_type,
        "expires_at": expires_ts,
        "sig": _sign_upload_token(message),
    }
    return base64.urlsafe_b64encode(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")


def _verify_upload_token(
    token: str,
    patient_id: str,
    file_url: str,
    content_type: str,
) -> bool:
    try:
        payload = json.loads(base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8"))
        expires_at = int(payload["expires_at"])
        token_patient_id = str(payload["patient_id"])
        token_file_url = str(payload["file_url"])
        token_content_type = str(payload["content_type"])
        signature = str(payload["sig"])
    except (binascii.Error, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return False

    if expires_at < int(datetime.now(UTC).timestamp()):
        return False
    if (
        token_patient_id != patient_id
        or token_file_url != file_url
        or token_content_type != content_type
    ):
        return False

    message = _upload_token_message(patient_id, file_url, content_type, expires_at)
    return hmac.compare_digest(signature, _sign_upload_token(message))


def _classify_document(document: PatientDocument) -> str:
    text = " ".join(
        item.lower()
        for item in [
            document.title,
            document.document_type,
            document.source,
            document.summary or "",
        ]
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
        return (
            f"{document.document_type} from {document.source} was processed and needs chart review."
        )
    return f"{document.document_type} metadata from {document.source} is available without an attached file."
