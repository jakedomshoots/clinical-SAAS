from pydantic import BaseModel

from app.schemas.fax import FaxOut
from app.schemas.patient_document import PatientDocumentOut
from app.schemas.schedule import AppointmentOut
from app.schemas.task import TaskOut


class PatientChartSummaryCounts(BaseModel):
    documents_total: int
    documents_needing_review: int
    open_tasks: int
    urgent_tasks: int
    recent_faxes: int
    upcoming_appointments: int


class PatientChartSummaryOut(BaseModel):
    patient_id: str
    checkout_readiness: str
    blockers: list[str]
    counts: PatientChartSummaryCounts
    documents: list[PatientDocumentOut]
    open_tasks: list[TaskOut]
    recent_faxes: list[FaxOut]
    upcoming_appointments: list[AppointmentOut]
