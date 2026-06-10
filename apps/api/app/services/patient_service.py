import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.patient import Patient
from app.models.user import User
from app.schemas.patient import PatientOut
from app.services.audit_service import log_event
from app.services.auth_service import generate_temporary_password, hash_password


def _generate_mrn() -> str:
    return f"MRN-{datetime.now(UTC):%Y%m%d%H%M%S}-{uuid.uuid4().hex[:6].upper()}"


def _portal_code_expires_at() -> datetime:
    return (
        datetime.now(UTC) + timedelta(minutes=settings.patient_portal_access_code_expire_minutes)
    ).replace(tzinfo=None)


async def list_patients(
    db: AsyncSession,
    user: User,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    is_active: bool | None = True,
) -> tuple[list[dict], int]:
    query = select(Patient).where(Patient.organization_id == user.organization_id)
    count_query = select(func.count(Patient.id)).where(
        Patient.organization_id == user.organization_id
    )

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


async def get_patient(db: AsyncSession, user: User, patient_id: str) -> dict | None:
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.organization_id == user.organization_id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        return None
    await log_event(
        db,
        event_type="patient.profile_viewed",
        entity_type="patient",
        entity_id=patient.id,
        actor_id=user.id,
        payload={
            "patient_id": patient.id,
            "surface": "patient_profile",
            "mrn": patient.mrn,
        },
    )
    return PatientOut.model_validate(patient).model_dump()


async def create_patient(
    db: AsyncSession,
    user: User,
    data: dict,
) -> dict:
    patient = Patient(
        organization_id=user.organization_id,
        mrn=_generate_mrn(),
        first_name=data["first_name"],
        last_name=data["last_name"],
        dob=data["dob"],
        gender=data["gender"],
        phone=data.get("phone"),
        email=data.get("email"),
        sms_consent=data.get("sms_consent", False),
        email_consent=data.get("email_consent", False),
        preferred_contact_channel=data.get("preferred_contact_channel"),
        address=data.get("address"),
        emergency_contact=data.get("emergency_contact"),
        insurance=data.get("insurance"),
        allergies=data.get("allergies", []),
        problem_list=data.get("problem_list", []),
    )
    if data.get("portal_access_code"):
        patient.portal_access_code_hash = hash_password(data["portal_access_code"])
        patient.portal_access_code_expires_at = _portal_code_expires_at()
    db.add(patient)
    await db.commit()
    await db.refresh(patient)

    await log_event(
        db,
        event_type="patient.created",
        entity_type="patient",
        entity_id=patient.id,
        actor_id=user.id,
        payload={
            "mrn": patient.mrn,
            "name": f"{patient.first_name} {patient.last_name}",
            "organization_id": user.organization_id,
        },
    )

    return PatientOut.model_validate(patient).model_dump()


async def update_patient(
    db: AsyncSession,
    user: User,
    patient_id: str,
    data: dict,
) -> dict | None:
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.organization_id == user.organization_id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        return None

    if data.get("portal_access_code"):
        patient.portal_access_code_hash = hash_password(data["portal_access_code"])
        patient.portal_access_code_expires_at = _portal_code_expires_at()

    for field, value in data.items():
        if field == "portal_access_code":
            continue
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


async def issue_portal_access_code(
    db: AsyncSession,
    user: User,
    patient_id: str,
) -> dict | None:
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.organization_id == user.organization_id,
            Patient.is_active.is_(True),
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        return None

    access_code = generate_temporary_password()
    expires_at = _portal_code_expires_at()
    patient.portal_access_code_hash = hash_password(access_code)
    patient.portal_access_code_expires_at = expires_at
    await db.commit()
    await db.refresh(patient)

    await log_event(
        db,
        event_type="patient.portal_access_code_issued",
        entity_type="patient",
        entity_id=patient.id,
        actor_id=user.id,
        payload={"expires_at": expires_at.isoformat()},
    )

    return {
        "patient_id": patient.id,
        "access_code": access_code,
        "expires_at": expires_at,
    }


async def deactivate_patient(
    db: AsyncSession,
    user: User,
    patient_id: str,
) -> dict | None:
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.organization_id == user.organization_id,
        )
    )
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
