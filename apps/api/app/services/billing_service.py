from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingCase, BillingStatus
from app.models.patient import Patient
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
