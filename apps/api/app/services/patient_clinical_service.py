from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.patient_clinical import (
    CarePlanStatus,
    EncounterStatus,
    LabResultStatus,
    MedicationStatus,
    PatientCarePlanItem,
    PatientEncounter,
    PatientLabResult,
    PatientMedication,
)
from app.models.schedule import Appointment
from app.models.user import User
from app.schemas.patient_clinical import PatientCarePlanItemOut, PatientEncounterOut, PatientLabResultOut, PatientMedicationOut
from app.services.audit_service import log_event
from datetime import UTC, datetime


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
    await log_event(
        db,
        "patient_clinical.medications_viewed",
        "patient",
        patient_id,
        actor_id=user.id,
        payload={
            "patient_id": patient_id,
            "surface": "medications",
        },
    )
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
    user_ids = {row.assigned_to_id for row in rows if row.assigned_to_id}
    user_map = {}
    if user_ids:
        users = await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids), User.organization_id == user.organization_id))
        user_map = {row.id: row.display_name for row in users}
    out = []
    for row in rows:
        data = PatientCarePlanItemOut.model_validate(row).model_dump()
        data["assigned_to_name"] = user_map.get(row.assigned_to_id)
        out.append(data)
    return out, len(rows)


async def create_care_plan_item(db: AsyncSession, user: User, patient_id: str, data: dict) -> dict | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    if data.get("assigned_to_id") and not await _user_exists(db, user, data["assigned_to_id"]):
        return None
    item = PatientCarePlanItem(
        organization_id=user.organization_id,
        patient_id=patient_id,
        assigned_to_id=data.get("assigned_to_id"),
        owner_role=data["owner_role"],
        item=data["item"],
        due=data.get("due"),
        status=CarePlanStatus(data.get("status", "open")),
        escalation=data.get("escalation"),
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
    if data.get("assigned_to_id") and not await _user_exists(db, user, data["assigned_to_id"]):
        return None
    for field, value in data.items():
        setattr(item, field, CarePlanStatus(value) if field == "status" and value is not None else value)
    await db.commit()
    await db.refresh(item)
    await log_event(db, "patient_care_plan.updated", "patient_care_plan", item.id, actor_id=user.id, payload={"patient_id": patient_id, "updated_fields": list(data.keys())})
    listed = await list_care_plan(db, user, patient_id)
    return next((row for row in listed[0] if row["id"] == item_id), None) if listed else None


async def _user_exists(db: AsyncSession, user: User, user_id: str) -> bool:
    return (
        await db.execute(
            select(User.id).where(
                User.id == user_id,
                User.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none() is not None


async def list_labs(db: AsyncSession, user: User, patient_id: str) -> tuple[list[dict], int] | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    rows = (
        await db.execute(
            select(PatientLabResult)
            .where(PatientLabResult.patient_id == patient_id, PatientLabResult.organization_id == user.organization_id)
            .order_by(PatientLabResult.collected_at.desc().nulls_last(), PatientLabResult.created_at.desc())
        )
    ).scalars().all()
    return [PatientLabResultOut.model_validate(row).model_dump() for row in rows], len(rows)


async def create_lab(db: AsyncSession, user: User, patient_id: str, data: dict) -> dict | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    lab = PatientLabResult(
        organization_id=user.organization_id,
        patient_id=patient_id,
        collected_at=data.get("collected_at"),
        panel=data["panel"],
        result=data["result"],
        flag=data.get("flag"),
        status=LabResultStatus(data.get("status", "new")),
        source=data.get("source"),
        note=data.get("note"),
    )
    db.add(lab)
    await db.commit()
    await db.refresh(lab)
    await log_event(db, "patient_lab.created", "patient_lab", lab.id, actor_id=user.id, payload={"patient_id": patient_id, "panel": lab.panel, "flag": lab.flag})
    return PatientLabResultOut.model_validate(lab).model_dump()


async def update_lab(db: AsyncSession, user: User, patient_id: str, lab_id: str, data: dict) -> dict | None:
    lab = (
        await db.execute(
            select(PatientLabResult).where(
                PatientLabResult.id == lab_id,
                PatientLabResult.patient_id == patient_id,
                PatientLabResult.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not lab:
        return None
    for field, value in data.items():
        setattr(lab, field, LabResultStatus(value) if field == "status" and value is not None else value)
    await db.commit()
    await db.refresh(lab)
    await log_event(db, "patient_lab.updated", "patient_lab", lab.id, actor_id=user.id, payload={"patient_id": patient_id, "updated_fields": list(data.keys())})
    return PatientLabResultOut.model_validate(lab).model_dump()


async def list_encounters(db: AsyncSession, user: User, patient_id: str) -> tuple[list[dict], int] | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    rows = (
        await db.execute(
            select(PatientEncounter)
            .where(PatientEncounter.patient_id == patient_id, PatientEncounter.organization_id == user.organization_id)
            .order_by(PatientEncounter.created_at.desc())
        )
    ).scalars().all()
    user_ids = {row.provider_id for row in rows if row.provider_id}
    user_map = {}
    if user_ids:
        users = await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids), User.organization_id == user.organization_id))
        user_map = {row.id: row.display_name for row in users}
    out = []
    for row in rows:
        data = PatientEncounterOut.model_validate(row).model_dump()
        data["provider_name"] = user_map.get(row.provider_id)
        out.append(data)
    return out, len(rows)


async def create_encounter(db: AsyncSession, user: User, patient_id: str, data: dict) -> dict | None:
    if not await _patient_exists(db, user, patient_id):
        return None
    appointment_id = data.get("appointment_id")
    if appointment_id:
        appointment = (
            await db.execute(
                select(Appointment.id, Appointment.provider_id).where(
                    Appointment.id == appointment_id,
                    Appointment.patient_id == patient_id,
                    Appointment.organization_id == user.organization_id,
                )
            )
        ).first()
        if not appointment:
            return None
    provider_id = data.get("provider_id") or getattr(user, "id", None)
    if provider_id:
        provider = (
            await db.execute(
                select(User.id).where(
                    User.id == provider_id,
                    User.organization_id == user.organization_id,
                )
            )
        ).scalar_one_or_none()
        if not provider:
            return None
    encounter = PatientEncounter(
        organization_id=user.organization_id,
        patient_id=patient_id,
        appointment_id=appointment_id,
        provider_id=provider_id,
        encounter_type=data.get("encounter_type", "office_visit"),
        status=EncounterStatus(data.get("status", "draft")),
        summary=data.get("summary"),
        subjective=data.get("subjective"),
        objective=data.get("objective"),
        assessment=data.get("assessment"),
        plan=data.get("plan"),
    )
    if encounter.status == EncounterStatus.signed:
        encounter.signed_at = datetime.now(UTC).replace(tzinfo=None)
    db.add(encounter)
    await db.commit()
    await db.refresh(encounter)
    await log_event(db, "patient_encounter.created", "patient_encounter", encounter.id, actor_id=user.id, payload={"patient_id": patient_id, "status": encounter.status.value})
    return (await list_encounters(db, user, patient_id))[0][0]


async def update_encounter(db: AsyncSession, user: User, patient_id: str, encounter_id: str, data: dict) -> dict | None:
    encounter = (
        await db.execute(
            select(PatientEncounter).where(
                PatientEncounter.id == encounter_id,
                PatientEncounter.patient_id == patient_id,
                PatientEncounter.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not encounter:
        return None
    if "appointment_id" in data and data["appointment_id"]:
        exists = (
            await db.execute(
                select(Appointment.id).where(
                    Appointment.id == data["appointment_id"],
                    Appointment.patient_id == patient_id,
                    Appointment.organization_id == user.organization_id,
                )
            )
        ).scalar_one_or_none()
        if not exists:
            return None
    if "provider_id" in data and data["provider_id"]:
        exists = (
            await db.execute(
                select(User.id).where(User.id == data["provider_id"], User.organization_id == user.organization_id)
            )
        ).scalar_one_or_none()
        if not exists:
            return None
    old_status = encounter.status
    for field, value in data.items():
        setattr(encounter, field, EncounterStatus(value) if field == "status" and value is not None else value)
    if encounter.status == EncounterStatus.signed and old_status != EncounterStatus.signed:
        encounter.signed_at = datetime.now(UTC).replace(tzinfo=None)
    await db.commit()
    await db.refresh(encounter)
    await log_event(db, "patient_encounter.updated", "patient_encounter", encounter.id, actor_id=user.id, payload={"patient_id": patient_id, "status": encounter.status.value, "updated_fields": list(data.keys())})
    listed = await list_encounters(db, user, patient_id)
    return next((item for item in listed[0] if item["id"] == encounter_id), None) if listed else None
