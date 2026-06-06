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
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.patient import PatientOut
from app.schemas.patient_clinical import (
    PatientCarePlanItemOut,
    PatientEncounterOut,
    PatientLabResultOut,
    PatientMedicationOut,
)
from app.schemas.patient_document import PatientDocumentOut
from app.schemas.patient_handoff import PatientCheckoutHandoffOut
from app.services.patient_chart_service import get_patient_chart_summary
from app.services.task_service import get_task
from app.services.audit_service import log_event


CHECKOUT_SOURCE_TYPES = {
    "document",
    "medication",
    "lab",
    "care_plan",
    "encounter",
}


async def get_checkout_handoff(
    db: AsyncSession,
    user: User,
    patient_id: str,
) -> PatientCheckoutHandoffOut | None:
    patient = (
        await db.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not patient:
        return None
    await log_event(
        db,
        "patient_checkout_handoff.viewed",
        "patient",
        patient_id,
        actor_id=user.id,
        payload={
            "patient_id": patient_id,
            "surface": "checkout_handoff",
        },
    )
    chart_summary = await get_patient_chart_summary(db, user, patient_id)
    if not chart_summary:
        return None

    documents = (
        await db.execute(
            select(PatientDocument)
            .where(
                PatientDocument.patient_id == patient_id,
                PatientDocument.organization_id == user.organization_id,
                PatientDocument.status == PatientDocumentStatus.needs_review,
            )
            .order_by(PatientDocument.received_at.desc())
        )
    ).scalars().all()
    medications = (
        await db.execute(
            select(PatientMedication)
            .where(
                PatientMedication.patient_id == patient_id,
                PatientMedication.organization_id == user.organization_id,
                PatientMedication.status.in_([MedicationStatus.review, MedicationStatus.held]),
            )
            .order_by(PatientMedication.name.asc())
        )
    ).scalars().all()
    labs = (
        await db.execute(
            select(PatientLabResult)
            .where(
                PatientLabResult.patient_id == patient_id,
                PatientLabResult.organization_id == user.organization_id,
                PatientLabResult.status.in_([LabResultStatus.new, LabResultStatus.needs_review]),
            )
            .order_by(PatientLabResult.collected_at.desc().nulls_last())
        )
    ).scalars().all()
    care_plan = (
        await db.execute(
            select(PatientCarePlanItem)
            .where(
                PatientCarePlanItem.patient_id == patient_id,
                PatientCarePlanItem.organization_id == user.organization_id,
                PatientCarePlanItem.status.in_([CarePlanStatus.open, CarePlanStatus.in_progress, CarePlanStatus.blocked]),
            )
            .order_by(PatientCarePlanItem.created_at.asc())
        )
    ).scalars().all()
    assignee_ids = {item.assigned_to_id for item in care_plan if item.assigned_to_id}
    assignee_map = {}
    if assignee_ids:
        assignees = await db.execute(
            select(User.id, User.display_name).where(
                User.id.in_(assignee_ids),
                User.organization_id == user.organization_id,
            )
        )
        assignee_map = {item.id: item.display_name for item in assignees}
    encounters = (
        await db.execute(
            select(PatientEncounter)
            .where(
                PatientEncounter.patient_id == patient_id,
                PatientEncounter.organization_id == user.organization_id,
                PatientEncounter.status.in_([EncounterStatus.draft, EncounterStatus.provider_review]),
            )
            .order_by(PatientEncounter.created_at.desc())
        )
    ).scalars().all()

    return PatientCheckoutHandoffOut(
        patient=PatientOut.model_validate(patient),
        chart_summary=chart_summary,
        documents_needing_review=[PatientDocumentOut.model_validate(item) for item in documents],
        medications_needing_review=[PatientMedicationOut.model_validate(item) for item in medications],
        labs_needing_review=[PatientLabResultOut.model_validate(item) for item in labs],
        care_plan_open_items=[
            _care_plan_out(item, assignee_map.get(item.assigned_to_id))
            for item in care_plan
        ],
        unsigned_encounters=[PatientEncounterOut.model_validate(item) for item in encounters],
    )


async def create_checkout_handoff_task(
    db: AsyncSession,
    user: User,
    patient_id: str,
    data: dict,
) -> dict | None:
    patient = (
        await db.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not patient:
        return None

    source_type = data["source_type"]
    source_id = data["source_id"]
    if source_type not in CHECKOUT_SOURCE_TYPES:
        raise ValueError("Unsupported checkout source type")

    source = await _get_open_handoff_source(db, user, patient_id, source_type, source_id)
    if source is None:
        return None

    existing = (
        await db.execute(
            select(Task).where(
                Task.organization_id == user.organization_id,
                Task.patient_id == patient_id,
                Task.source_type == f"checkout_handoff:{source_type}",
                Task.source_id == source_id,
                Task.status.in_([TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]),
            )
        )
    ).scalar_one_or_none()
    if existing:
        return await get_task(db, user, existing.id)

    title = data.get("title") or _default_task_title(source_type, source)
    description = data.get("description") or _default_task_description(source_type, source)
    assigned_to_id = data.get("assigned_to_id") or getattr(source, "assigned_to_id", None)
    priority = TaskPriority(data.get("priority", "high"))
    task = Task(
        organization_id=user.organization_id,
        title=title,
        description=description,
        priority=priority,
        status=TaskStatus.open,
        assigned_to_id=assigned_to_id,
        patient_id=patient_id,
        source_type=f"checkout_handoff:{source_type}",
        source_id=source_id,
        creator_id=user.id,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await log_event(
        db,
        "checkout_handoff.task_created",
        "task",
        task.id,
        actor_id=user.id,
        payload={
            "patient_id": patient_id,
            "source_type": source_type,
            "source_id": source_id,
            "priority": task.priority.value,
        },
    )
    return await get_task(db, user, task.id)


def _care_plan_out(item: PatientCarePlanItem, assigned_to_name: str | None) -> PatientCarePlanItemOut:
    data = PatientCarePlanItemOut.model_validate(item).model_dump()
    data["assigned_to_name"] = assigned_to_name
    return PatientCarePlanItemOut(**data)


async def _get_open_handoff_source(
    db: AsyncSession,
    user: User,
    patient_id: str,
    source_type: str,
    source_id: str,
):
    common = {
        "id": source_id,
        "patient_id": patient_id,
        "organization_id": user.organization_id,
    }
    if source_type == "document":
        return (
            await db.execute(
                select(PatientDocument).where(
                    PatientDocument.status == PatientDocumentStatus.needs_review,
                    *[getattr(PatientDocument, key) == value for key, value in common.items()],
                )
            )
        ).scalar_one_or_none()
    if source_type == "medication":
        return (
            await db.execute(
                select(PatientMedication).where(
                    PatientMedication.status.in_([MedicationStatus.review, MedicationStatus.held]),
                    *[getattr(PatientMedication, key) == value for key, value in common.items()],
                )
            )
        ).scalar_one_or_none()
    if source_type == "lab":
        return (
            await db.execute(
                select(PatientLabResult).where(
                    PatientLabResult.status.in_([LabResultStatus.new, LabResultStatus.needs_review]),
                    *[getattr(PatientLabResult, key) == value for key, value in common.items()],
                )
            )
        ).scalar_one_or_none()
    if source_type == "care_plan":
        return (
            await db.execute(
                select(PatientCarePlanItem).where(
                    PatientCarePlanItem.status.in_([CarePlanStatus.open, CarePlanStatus.in_progress, CarePlanStatus.blocked]),
                    *[getattr(PatientCarePlanItem, key) == value for key, value in common.items()],
                )
            )
        ).scalar_one_or_none()
    return (
        await db.execute(
            select(PatientEncounter).where(
                PatientEncounter.status.in_([EncounterStatus.draft, EncounterStatus.provider_review]),
                *[getattr(PatientEncounter, key) == value for key, value in common.items()],
            )
        )
    ).scalar_one_or_none()


def _default_task_title(source_type: str, source) -> str:
    if source_type == "document":
        return f"Review document: {source.title}"
    if source_type == "medication":
        return f"Resolve medication: {source.name}"
    if source_type == "lab":
        return f"Review lab: {source.panel}"
    if source_type == "care_plan":
        return source.item
    return f"Sign encounter: {source.encounter_type}"


def _default_task_description(source_type: str, source) -> str:
    if source_type == "document":
        return f"{source.document_type} from {source.source}; status {source.status.value}."
    if source_type == "medication":
        return f"{source.name} requires checkout reconciliation; status {source.status.value}."
    if source_type == "lab":
        return f"{source.panel}: {source.result}; status {source.status.value}."
    if source_type == "care_plan":
        return source.note or f"{source.owner_role} checkout work item; status {source.status.value}."
    return source.summary or f"{source.encounter_type} is {source.status.value}."
