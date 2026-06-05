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
        care_plan_open_items=[PatientCarePlanItemOut.model_validate(item) for item in care_plan],
        unsigned_encounters=[PatientEncounterOut.model_validate(item) for item in encounters],
    )
