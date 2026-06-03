from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.fax import Fax, FaxDirection, FaxStatus
from app.models.user import User
from app.models.patient import Patient
from app.services.audit_service import log_event


def _fax_to_dict(fax: Fax, pat_name: str | None = None) -> dict:
    return {
        "id": fax.id,
        "direction": fax.direction.value,
        "status": fax.status.value,
        "from_number": fax.from_number,
        "to_number": fax.to_number,
        "pages": fax.pages,
        "file_url": fax.file_url,
        "patient_id": fax.patient_id,
        "patient_name": pat_name,
        "matched_by": fax.matched_by,
        "ocr_text": fax.ocr_text,
        "created_at": fax.created_at.isoformat() if fax.created_at else None,
    }


async def list_faxes(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    direction: str | None = None,
    status: str | None = None,
    patient_id: str | None = None,
) -> tuple[list[dict], int]:
    query = select(Fax)
    countq = select(func.count(Fax.id))

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
    query = query.order_by(Fax.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    faxes = result.scalars().all()

    pat_ids = {f.patient_id for f in faxes if f.patient_id}
    pat_map: dict[str, str] = {}
    if pat_ids:
        p = await db.execute(select(Patient.id, Patient.first_name, Patient.last_name).where(Patient.id.in_(pat_ids)))
        pat_map = {r.id: f"{r.last_name}, {r.first_name}" for r in p}

    return [_fax_to_dict(f, pat_map.get(f.patient_id)) for f in faxes], total


async def get_fax(db: AsyncSession, fax_id: str) -> dict | None:
    result = await db.execute(select(Fax).where(Fax.id == fax_id))
    fax = result.scalar_one_or_none()
    if not fax:
        return None
    pat_name = None
    if fax.patient_id:
        p = await db.get(Patient, fax.patient_id)
        pat_name = f"{p.last_name}, {p.first_name}" if p else None
    return _fax_to_dict(fax, pat_name)


async def create_inbound_fax(db: AsyncSession, from_number: str, to_number: str, file_url: str | None = None, ocr_text: str | None = None) -> dict:
    fax = Fax(
        direction=FaxDirection.inbound,
        status=FaxStatus.received,
        from_number=from_number,
        to_number=to_number,
        file_url=file_url,
        ocr_text=ocr_text,
        pages=1,
    )
    db.add(fax)
    await db.commit()
    await db.refresh(fax)

    await log_event(db, "fax.received", "fax", fax.id, payload={"from": from_number, "to": to_number})
    return _fax_to_dict(fax)


async def send_fax(db: AsyncSession, user: User, to_number: str, patient_id: str | None = None, file_url: str | None = None) -> dict:
    fax = Fax(
        direction=FaxDirection.outbound,
        status=FaxStatus.pending,
        from_number="",  # configured per clinic
        to_number=to_number,
        patient_id=patient_id,
        file_url=file_url,
        pages=1,
    )
    db.add(fax)
    await db.commit()
    await db.refresh(fax)

    await log_event(db, "fax.sent", "fax", fax.id, actor_id=user.id, payload={"to": to_number})
    return await get_fax(db, fax.id)


async def match_fax(db: AsyncSession, user: User, fax_id: str, patient_id: str) -> dict | None:
    result = await db.execute(select(Fax).where(Fax.id == fax_id))
    fax = result.scalar_one_or_none()
    if not fax:
        return None

    fax.patient_id = patient_id
    fax.matched_by = "manual"
    await db.commit()
    await db.refresh(fax)

    await log_event(db, "fax.matched", "fax", fax.id, actor_id=user.id, payload={"patient_id": patient_id})
    return await get_fax(db, fax.id)
