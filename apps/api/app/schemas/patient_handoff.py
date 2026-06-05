from app.schemas.patient import PatientOut
from app.schemas.patient_chart import PatientChartSummaryOut
from app.schemas.patient_clinical import (
    PatientCarePlanItemOut,
    PatientEncounterOut,
    PatientLabResultOut,
    PatientMedicationOut,
)
from app.schemas.patient_document import PatientDocumentOut
from pydantic import BaseModel


class PatientCheckoutHandoffOut(BaseModel):
    patient: PatientOut
    chart_summary: PatientChartSummaryOut
    documents_needing_review: list[PatientDocumentOut]
    medications_needing_review: list[PatientMedicationOut]
    labs_needing_review: list[PatientLabResultOut]
    care_plan_open_items: list[PatientCarePlanItemOut]
    unsigned_encounters: list[PatientEncounterOut]
