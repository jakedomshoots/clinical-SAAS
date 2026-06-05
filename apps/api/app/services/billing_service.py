from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingCase, BillingStatus
from app.models.patient import Patient
from app.models.patient_clinical import PatientEncounter
from app.models.user import User
from app.services.audit_service import log_event


async def list_cases(db: AsyncSession, user: User) -> tuple[list[BillingCase], int]:
    query = select(BillingCase).where(BillingCase.organization_id == user.organization_id)
    countq = select(func.count(BillingCase.id)).where(BillingCase.organization_id == user.organization_id)
    total = (await db.execute(countq)).scalar() or 0
    result = await db.execute(query.order_by(BillingCase.created_at.desc()).limit(100))
    return list(result.scalars().all()), total


async def create_case(db: AsyncSession, user: User, data: dict) -> BillingCase | None:
    patient = (await db.execute(select(Patient.id).where(Patient.id == data["patient_id"], Patient.organization_id == user.organization_id))).scalar_one_or_none()
    if not patient:
        return None
    case = BillingCase(organization_id=user.organization_id, **data)
    if not case.payer:
        patient_row = (await db.execute(select(Patient).where(Patient.id == data["patient_id"]))).scalar_one()
        case.payer = (patient_row.insurance or {}).get("provider")
    db.add(case)
    await db.commit()
    await db.refresh(case)
    await log_event(db, "billing.case_created", "billing_case", case.id, actor_id=user.id, payload={"patient_id": case.patient_id})
    return case


async def create_case_from_encounter(db: AsyncSession, user: User, encounter_id: str) -> BillingCase | None:
    encounter = (await db.execute(
        select(PatientEncounter).where(
            PatientEncounter.id == encounter_id,
            PatientEncounter.organization_id == user.organization_id,
        )
    )).scalar_one_or_none()
    if not encounter:
        return None
    existing = (await db.execute(
        select(BillingCase).where(
            BillingCase.organization_id == user.organization_id,
            BillingCase.patient_id == encounter.patient_id,
            BillingCase.appointment_id == encounter.appointment_id,
        )
    )).scalar_one_or_none()
    if existing:
        return existing
    return await create_case(db, user, {
        "patient_id": encounter.patient_id,
        "appointment_id": encounter.appointment_id,
        "cpt_codes": ["99213"],
        "diagnosis_codes": [],
        "notes": f"Charge capture from {encounter.encounter_type} encounter.",
    })


async def check_eligibility(db: AsyncSession, user: User, patient_id: str) -> dict | None:
    patient = (await db.execute(select(Patient).where(Patient.id == patient_id, Patient.organization_id == user.organization_id))).scalar_one_or_none()
    if not patient:
        return None
    payer = (patient.insurance or {}).get("provider")
    status = "eligible" if payer else "missing_insurance"
    result = await db.execute(
        select(BillingCase).where(
            BillingCase.organization_id == user.organization_id,
            BillingCase.patient_id == patient.id,
            BillingCase.status == BillingStatus.draft,
        )
    )
    for case in result.scalars().all():
        case.eligibility_status = status
    await db.commit()
    await log_event(db, "billing.eligibility_checked", "patient", patient.id, actor_id=user.id, payload={"payer": payer, "status": status})
    return {
        "patient_id": patient.id,
        "payer": payer,
        "status": status,
        "reference_id": f"demo-elig-{patient.id[-6:]}",
        "message": "Demo eligibility staged. Configure a payer clearinghouse before live use." if payer else "Insurance is missing from chart.",
    }


async def update_case(db: AsyncSession, user: User, case_id: str, data: dict) -> BillingCase | None:
    case = (await db.execute(select(BillingCase).where(BillingCase.id == case_id, BillingCase.organization_id == user.organization_id))).scalar_one_or_none()
    if not case:
        return None
    for field, value in data.items():
        if hasattr(case, field) and value is not None:
            setattr(case, field, BillingStatus(value) if field == "status" else value)
    await db.commit()
    await db.refresh(case)
    await log_event(db, "billing.case_updated", "billing_case", case.id, actor_id=user.id, payload={"updated_fields": list(data.keys())})
    return case
