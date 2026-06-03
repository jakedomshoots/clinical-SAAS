from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.patient import Patient
from app.models.user import User
from app.services.audit_service import log_event
import uuid


def _generate_mrn() -> str:
    return f"MRN-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{uuid.uuid4().hex[:6].upper()}"


from app.schemas.patient import PatientOut


async def list_patients(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    is_active: bool | None = True,
) -> tuple[list[dict], int]:
    query = select(Patient)
    count_query = select(func.count(Patient.id))

    if is_active is not None:
        query = query.where(Patient.is_active == is_active)
        count_query = count_query.where(Patient.is_active == is_active)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Patient.first_name.ilike(search_term))
            | (Patient.last_name.ilike(search_term))
            | (Patient.mrn.ilike(search_term))
        )
        count_query = count_query.where(
            (Patient.first_name.ilike(search_term))
            | (Patient.last_name.ilike(search_term))
            | (Patient.mrn.ilike(search_term))
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(Patient.last_name, Patient.first_name).offset(offset).limit(page_size)
    result = await db.execute(query)
    patients = result.scalars().all()

    return [PatientOut.model_validate(p).model_dump() for p in patients], total


async def get_patient(db: AsyncSession, patient_id: str) -> dict | None:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    return PatientOut.model_validate(patient).model_dump() if patient else None


async def create_patient(
    db: AsyncSession,
    user: User,
    data: dict,
) -> dict:
    patient = Patient(
        mrn=_generate_mrn(),
        first_name=data["first_name"],
        last_name=data["last_name"],
        dob=data["dob"],
        gender=data["gender"],
        phone=data.get("phone"),
        email=data.get("email"),
        address=data.get("address"),
        emergency_contact=data.get("emergency_contact"),
        insurance=data.get("insurance"),
        allergies=data.get("allergies", []),
        problem_list=data.get("problem_list", []),
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)

    await log_event(
        db,
        event_type="patient.created",
        entity_type="patient",
        entity_id=patient.id,
        actor_id=user.id,
        payload={"mrn": patient.mrn, "name": f"{patient.first_name} {patient.last_name}"},
    )

    return PatientOut.model_validate(patient).model_dump()


async def update_patient(
    db: AsyncSession,
    user: User,
    patient_id: str,
    data: dict,
) -> dict | None:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        return None

    for field, value in data.items():
        if hasattr(patient, field):
            setattr(patient, field, value)

    await db.commit()
    await db.refresh(patient)

    await log_event(
        db,
        event_type="patient.updated",
        entity_type="patient",
        entity_id=patient.id,
        actor_id=user.id,
        payload={"updated_fields": list(data.keys())},
    )

    return PatientOut.model_validate(patient).model_dump()


async def deactivate_patient(
    db: AsyncSession,
    user: User,
    patient_id: str,
) -> dict | None:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        return None

    patient.is_active = False
    await db.commit()
    await db.refresh(patient)

    await log_event(
        db,
        event_type="patient.deactivated",
        entity_type="patient",
        entity_id=patient.id,
        actor_id=user.id,
        payload={"mrn": patient.mrn},
    )

    return PatientOut.model_validate(patient).model_dump()
