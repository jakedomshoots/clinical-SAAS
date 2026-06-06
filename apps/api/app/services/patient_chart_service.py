from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fax import Fax
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
from app.models.schedule import Appointment, AppointmentStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.patient_chart import PatientChartSummaryCounts, PatientChartSummaryOut
from app.schemas.patient_document import PatientDocumentOut
from app.services.fax_service import _make_fax_dict
from app.services.schedule_service import _make_appt_dict
from app.services.audit_service import log_event
from app.services.task_service import _make_task_dict


async def get_patient_chart_summary(
    db: AsyncSession,
    user: User,
    patient_id: str,
) -> PatientChartSummaryOut | None:
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

    await log_event(
        db,
        "patient_chart.viewed",
        "patient",
        patient_id,
        actor_id=user.id,
        payload={
            "patient_id": patient_id,
            "surface": "chart_summary",
        },
    )

    now = datetime.now(UTC).replace(tzinfo=None)
    upcoming_window = now + timedelta(days=30)

    document_rows = (
        await db.execute(
            select(PatientDocument)
            .where(
                PatientDocument.patient_id == patient_id,
                PatientDocument.organization_id == user.organization_id,
            )
            .order_by(PatientDocument.received_at.desc())
            .limit(5)
        )
    ).scalars().all()

    open_task_rows = (
        await db.execute(
            select(Task)
            .where(
                Task.patient_id == patient_id,
                Task.organization_id == user.organization_id,
                Task.status.in_([TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]),
            )
            .order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
            .limit(5)
        )
    ).scalars().all()

    fax_rows = (
        await db.execute(
            select(Fax)
            .where(
                Fax.patient_id == patient_id,
                Fax.organization_id == user.organization_id,
            )
            .order_by(Fax.created_at.desc())
            .limit(5)
        )
    ).scalars().all()

    appointment_rows = (
        await db.execute(
            select(Appointment)
            .where(
                Appointment.patient_id == patient_id,
                Appointment.organization_id == user.organization_id,
                Appointment.start_time >= now,
                Appointment.start_time <= upcoming_window,
                Appointment.status.in_(
                    [
                        AppointmentStatus.scheduled,
                        AppointmentStatus.checked_in,
                        AppointmentStatus.roomed,
                        AppointmentStatus.provider_review,
                        AppointmentStatus.checkout,
                        AppointmentStatus.in_progress,
                    ]
                ),
            )
            .order_by(Appointment.start_time.asc())
            .limit(5)
        )
    ).scalars().all()

    documents_total = (
        await db.execute(
            select(func.count(PatientDocument.id)).where(
                PatientDocument.patient_id == patient_id,
                PatientDocument.organization_id == user.organization_id,
            )
        )
    ).scalar() or 0
    documents_needing_review = (
        await db.execute(
            select(func.count(PatientDocument.id)).where(
                PatientDocument.patient_id == patient_id,
                PatientDocument.organization_id == user.organization_id,
                PatientDocument.status == PatientDocumentStatus.needs_review,
            )
        )
    ).scalar() or 0
    open_tasks = (
        await db.execute(
            select(func.count(Task.id)).where(
                Task.patient_id == patient_id,
                Task.organization_id == user.organization_id,
                Task.status.in_([TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]),
            )
        )
    ).scalar() or 0
    urgent_tasks = (
        await db.execute(
            select(func.count(Task.id)).where(
                Task.patient_id == patient_id,
                Task.organization_id == user.organization_id,
                Task.status.in_([TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]),
                Task.priority == TaskPriority.urgent,
            )
        )
    ).scalar() or 0
    unsigned_encounters = (
        await db.execute(
            select(func.count(PatientEncounter.id)).where(
                PatientEncounter.patient_id == patient_id,
                PatientEncounter.organization_id == user.organization_id,
                PatientEncounter.status.in_([EncounterStatus.draft, EncounterStatus.provider_review]),
            )
        )
    ).scalar() or 0
    medications_needing_review = (
        await db.execute(
            select(func.count(PatientMedication.id)).where(
                PatientMedication.patient_id == patient_id,
                PatientMedication.organization_id == user.organization_id,
                PatientMedication.status == MedicationStatus.review,
            )
        )
    ).scalar() or 0
    labs_needing_review = (
        await db.execute(
            select(func.count(PatientLabResult.id)).where(
                PatientLabResult.patient_id == patient_id,
                PatientLabResult.organization_id == user.organization_id,
                PatientLabResult.status.in_([LabResultStatus.new, LabResultStatus.needs_review]),
            )
        )
    ).scalar() or 0
    care_plan_blockers = (
        await db.execute(
            select(func.count(PatientCarePlanItem.id)).where(
                PatientCarePlanItem.patient_id == patient_id,
                PatientCarePlanItem.organization_id == user.organization_id,
                PatientCarePlanItem.status == CarePlanStatus.blocked,
            )
        )
    ).scalar() or 0

    blockers: list[str] = []
    if documents_needing_review:
        blockers.append(f"{documents_needing_review} outside document needs review")
    if urgent_tasks:
        blockers.append(f"{urgent_tasks} urgent task is still open")
    if unsigned_encounters:
        blockers.append(f"{unsigned_encounters} encounter note needs sign-off")
    if medications_needing_review:
        blockers.append(f"{medications_needing_review} medication needs reconciliation")
    if labs_needing_review:
        blockers.append(f"{labs_needing_review} lab result needs review")
    if care_plan_blockers:
        blockers.append(f"{care_plan_blockers} care plan item is blocked")
    if not blockers and open_tasks:
        blockers.append(f"{open_tasks} open task remains for checkout")

    checkout_readiness = (
        "blocked"
        if (
            documents_needing_review
            or urgent_tasks
            or unsigned_encounters
            or medications_needing_review
            or labs_needing_review
            or care_plan_blockers
        )
        else "ready"
    )

    return PatientChartSummaryOut(
        patient_id=patient_id,
        checkout_readiness=checkout_readiness,
        blockers=blockers,
        counts=PatientChartSummaryCounts(
            documents_total=documents_total,
            documents_needing_review=documents_needing_review,
            open_tasks=open_tasks,
            urgent_tasks=urgent_tasks,
            recent_faxes=len(fax_rows),
            upcoming_appointments=len(appointment_rows),
            unsigned_encounters=unsigned_encounters,
            medications_needing_review=medications_needing_review,
            labs_needing_review=labs_needing_review,
            care_plan_blockers=care_plan_blockers,
        ),
        documents=[PatientDocumentOut.model_validate(document) for document in document_rows],
        open_tasks=[_make_task_dict(task) for task in open_task_rows],
        recent_faxes=[_make_fax_dict(fax) for fax in fax_rows],
        upcoming_appointments=[_make_appt_dict(appointment) for appointment in appointment_rows],
    )
