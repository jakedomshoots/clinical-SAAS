from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fax import Fax, FaxDirection, FaxStatus
from app.models.patient import Patient
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.services.audit_service import log_event


async def list_faxes(
    db: AsyncSession,
    user: User,
    page: int = 1,
    page_size: int = 20,
    direction: str | None = None,
    status: str | None = None,
    patient_id: str | None = None,
) -> tuple[list[dict], int]:
    query = select(Fax).where(Fax.organization_id == user.organization_id)
    countq = select(func.count(Fax.id)).where(Fax.organization_id == user.organization_id)
    if direction:
        query = query.where(Fax.direction == FaxDirection(direction))
        countq = countq.where(Fax.direction == FaxDirection(direction))
    if status:
        query = query.where(Fax.status == FaxStatus(status))
        countq = countq.where(Fax.status == FaxStatus(status))
    if patient_id:
        query = query.where(Fax.patient_id == patient_id)
        countq = countq.where(Fax.patient_id == patient_id)

    total = (await db.execute(countq)).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Fax.created_at.desc()).offset(offset).limit(page_size))
    faxes = result.scalars().all()

    pat_ids = {f.patient_id for f in faxes if f.patient_id}
    pat_map: dict[str, str] = {}
    if pat_ids:
        p = await db.execute(
            select(Patient.id, Patient.first_name, Patient.last_name).where(
                Patient.id.in_(pat_ids),
                Patient.organization_id == user.organization_id,
            )
        )
        pat_map = {r.id: f"{r.last_name}, {r.first_name}" for r in p}

    out = []
    for f in faxes:
        d = _make_fax_dict(f)
        d["patient_name"] = pat_map.get(f.patient_id)
        out.append(d)
    return out, total


async def get_fax(db: AsyncSession, user: User, fax_id: str) -> dict | None:
    result = await db.execute(
        select(Fax).where(
            Fax.id == fax_id,
            Fax.organization_id == user.organization_id,
        )
    )
    fax = result.scalar_one_or_none()
    if not fax:
        return None
    d = _make_fax_dict(fax)
    if fax.patient_id:
        p = (
            await db.execute(
                select(Patient).where(
                    Patient.id == fax.patient_id,
                    Patient.organization_id == user.organization_id,
                )
            )
        ).scalar_one_or_none()
        d["patient_name"] = f"{p.last_name}, {p.first_name}" if p else None
    return d


async def send_fax(
    db: AsyncSession,
    user: User,
    to_number: str,
    patient_id: str | None = None,
    file_url: str | None = None,
    pages: int = 1,
    ocr_text: str | None = None,
) -> dict | None:
    if patient_id:
        patient = (
            await db.execute(
                select(Patient.id).where(
                    Patient.id == patient_id,
                    Patient.organization_id == user.organization_id,
                )
            )
        ).scalar_one_or_none()
        if not patient:
            return None

    fax = Fax(
        organization_id=user.organization_id,
        direction=FaxDirection.outbound,
        status=FaxStatus.pending,
        from_number="",
        to_number=to_number,
        patient_id=patient_id,
        file_url=file_url,
        pages=pages,
        ocr_text=ocr_text,
    )
    db.add(fax)
    await db.commit()
    await db.refresh(fax)
    await log_event(db, "fax.sent", "fax", fax.id, actor_id=user.id, payload={"to": to_number})
    return await get_fax(db, user, fax.id)


async def match_fax(db: AsyncSession, user: User, fax_id: str, patient_id: str) -> dict | None:
    result = await db.execute(
        select(Fax).where(
            Fax.id == fax_id,
            Fax.organization_id == user.organization_id,
        )
    )
    fax = result.scalar_one_or_none()
    if not fax:
        return None
    patient = (
        await db.execute(
            select(Patient.id).where(
                Patient.id == patient_id,
                Patient.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not patient:
        return None
    fax.patient_id = patient_id
    fax.matched_by = "manual"
    created_document: PatientDocument | None = None
    if fax.direction == FaxDirection.inbound and fax.file_url:
        document_exists = (
            await db.execute(
                select(PatientDocument.id).where(
                    PatientDocument.organization_id == user.organization_id,
                    PatientDocument.patient_id == patient_id,
                    PatientDocument.file_url == fax.file_url,
                )
            )
        ).scalar_one_or_none()
        if not document_exists:
            created_document = PatientDocument(
                organization_id=user.organization_id,
                patient_id=patient_id,
                title="Inbound fax document",
                source=fax.from_number,
                document_type="Fax",
                status=PatientDocumentStatus.needs_review,
                matched_by="fax match",
                pages=fax.pages,
                file_url=fax.file_url,
                summary=fax.ocr_text,
                received_at=fax.created_at,
            )
            db.add(created_document)
            await db.flush()
            db.add(
                Task(
                    organization_id=user.organization_id,
                    title="Review inbound fax document",
                    description=(
                        fax.ocr_text
                        or "Inbound fax was matched to the patient and needs chart review."
                    ),
                    priority=TaskPriority.high,
                    status=TaskStatus.open,
                    patient_id=patient_id,
                    creator_id=user.id,
                    source_type="document_intake:fax",
                    source_id=created_document.id,
                )
            )
    await db.commit()
    await db.refresh(fax)
    await log_event(
        db,
        "fax.matched",
        "fax",
        fax.id,
        actor_id=user.id,
        payload={"patient_id": patient_id},
    )
    return await get_fax(db, user, fax.id)


def _make_fax_dict(f: Fax) -> dict:
    return {
        "id": f.id,
        "direction": f.direction.value,
        "status": f.status.value,
        "from_number": f.from_number,
        "to_number": f.to_number,
        "pages": f.pages,
        "file_url": f.file_url,
        "patient_id": f.patient_id,
        "patient_name": None,
        "matched_by": f.matched_by,
        "ocr_text": f.ocr_text,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }
