import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.patient import Patient
from app.models.user import User
from app.services.audit_service import log_event


def _generate_mrn(db_session: AsyncSession) -> str:
    """Simple sequential MRN. Replace with your org's format."""
    return f"MRN-{datetime.datetime.utcnow():%Y%m%d%H%M%S}"


def _patient_to_dict(patient: Patient) -> dict:
    return {
        "id": patient.id,
        "mrn": patient.mrn,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "dob": patient.dob.isoformat() if patient.dob else None,
        "gender": patient.gender,
        "phone": patient.phone,
        "email": patient.email,
        "address": patient.address,
        "emergency_contact": patient.emergency_contact,
        "insurance": patient.insurance,
        "allergies": patient.allergies,
        "problem_list": patient.problem_list,
        "is_active": patient.is_active,
        "created_at": patient.created_at.isoformat() if patient.created_at else None,
        "updated_at": patient.updated_at.isoformat() if patient.updated_at else None,
    }


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

    return [_patient_to_dict(p) for p in patients], total


async def get_patient(db: AsyncSession, patient_id: str) -> dict | None:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    return _patient_to_dict(patient) if patient else None


async def create_patient(
    db: AsyncSession,
    user: User,
    data: dict,
) -> dict:
    patient = Patient(
        mrn=_generate_mrn(db),
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

    return _patient_to_dict(patient)


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
        if value is not None and hasattr(patient, field):
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

    return _patient_to_dict(patient)


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

    return _patient_to_dict(patient)
