from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.patient_clinical import (
    CarePlanStatus,
    MedicationStatus,
    PatientCarePlanItem,
    PatientMedication,
)
from app.models.user import User
from app.schemas.patient_clinical import PatientCarePlanItemOut, PatientMedicationOut
from app.services.audit_service import log_event


async def _patient_exists(db: AsyncSession, user: User, patient_id: str) -> bool:
    return (
        await db.execute(
            select(Patient.id).where(
                Patient.id == patient_id,
                Patient.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none() is not None


async def list_medications(db: AsyncSession, user: User, patient_id: str) -> tuple[list[dict], int] | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    rows = (
        await db.execute(
            select(PatientMedication)
            .where(PatientMedication.patient_id == patient_id, PatientMedication.organization_id == user.organization_id)
            .order_by(PatientMedication.name.asc())
        )
    ).scalars().all()
    return [PatientMedicationOut.model_validate(row).model_dump() for row in rows], len(rows)


async def create_medication(db: AsyncSession, user: User, patient_id: str, data: dict) -> dict | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    med = PatientMedication(
        organization_id=user.organization_id,
        patient_id=patient_id,
        name=data["name"],
        dose=data.get("dose"),
        directions=data.get("directions"),
        source=data.get("source"),
        status=MedicationStatus(data.get("status", "active")),
        note=data.get("note"),
    )
    db.add(med)
    await db.commit()
    await db.refresh(med)
    await log_event(db, "patient_medication.created", "patient_medication", med.id, actor_id=user.id, payload={"patient_id": patient_id, "name": med.name})
    return PatientMedicationOut.model_validate(med).model_dump()


async def update_medication(db: AsyncSession, user: User, patient_id: str, medication_id: str, data: dict) -> dict | None:
    med = (
        await db.execute(
            select(PatientMedication).where(
                PatientMedication.id == medication_id,
                PatientMedication.patient_id == patient_id,
                PatientMedication.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not med:
        return None
    for field, value in data.items():
        setattr(med, field, MedicationStatus(value) if field == "status" and value is not None else value)
    await db.commit()
    await db.refresh(med)
    await log_event(db, "patient_medication.updated", "patient_medication", med.id, actor_id=user.id, payload={"patient_id": patient_id, "updated_fields": list(data.keys())})
    return PatientMedicationOut.model_validate(med).model_dump()


async def list_care_plan(db: AsyncSession, user: User, patient_id: str) -> tuple[list[dict], int] | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    rows = (
        await db.execute(
            select(PatientCarePlanItem)
            .where(PatientCarePlanItem.patient_id == patient_id, PatientCarePlanItem.organization_id == user.organization_id)
            .order_by(PatientCarePlanItem.created_at.asc())
        )
    ).scalars().all()
    return [PatientCarePlanItemOut.model_validate(row).model_dump() for row in rows], len(rows)


async def create_care_plan_item(db: AsyncSession, user: User, patient_id: str, data: dict) -> dict | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    item = PatientCarePlanItem(
        organization_id=user.organization_id,
        patient_id=patient_id,
        owner_role=data["owner_role"],
        item=data["item"],
        due=data.get("due"),
        status=CarePlanStatus(data.get("status", "open")),
        note=data.get("note"),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    await log_event(db, "patient_care_plan.created", "patient_care_plan", item.id, actor_id=user.id, payload={"patient_id": patient_id, "owner_role": item.owner_role})
    return PatientCarePlanItemOut.model_validate(item).model_dump()


async def update_care_plan_item(db: AsyncSession, user: User, patient_id: str, item_id: str, data: dict) -> dict | None:
    item = (
        await db.execute(
            select(PatientCarePlanItem).where(
                PatientCarePlanItem.id == item_id,
                PatientCarePlanItem.patient_id == patient_id,
                PatientCarePlanItem.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not item:
        return None
    for field, value in data.items():
        setattr(item, field, CarePlanStatus(value) if field == "status" and value is not None else value)
    await db.commit()
    await db.refresh(item)
    await log_event(db, "patient_care_plan.updated", "patient_care_plan", item.id, actor_id=user.id, payload={"patient_id": patient_id, "updated_fields": list(data.keys())})
    return PatientCarePlanItemOut.model_validate(item).model_dump()
