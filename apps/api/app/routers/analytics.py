from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.billing import BillingCase, BillingStatus
from app.models.fax import Fax
from app.models.patient_clinical import EncounterStatus, PatientEncounter
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.portal_intake import PortalIntakeStatus, PortalIntakeSubmission
from app.models.schedule import Appointment, AppointmentStatus
from app.models.task import Task, TaskStatus
from app.models.user import User

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.get("/summary")
async def summary(db: DbDep, current_user: CurrentUserDep):
    org = current_user.organization_id

    async def count(model, *clauses) -> int:
        result = await db.execute(select(func.count(model.id)).where(model.organization_id == org, *clauses))
        return result.scalar() or 0

    return {
        "schedule": {
            "scheduled": await count(Appointment, Appointment.status == AppointmentStatus.scheduled),
            "active": await count(Appointment, Appointment.status.in_([AppointmentStatus.checked_in, AppointmentStatus.roomed, AppointmentStatus.provider_review, AppointmentStatus.checkout])),
            "no_show": await count(Appointment, Appointment.status == AppointmentStatus.no_show),
        },
        "work": {
            "open_tasks": await count(Task, Task.status.in_([TaskStatus.open, TaskStatus.in_progress])),
            "documents_needing_review": await count(PatientDocument, PatientDocument.status == PatientDocumentStatus.needs_review),
            "unsigned_encounters": await count(PatientEncounter, PatientEncounter.status.in_([EncounterStatus.draft, EncounterStatus.provider_review])),
        },
        "front_office": {
            "unmatched_faxes": await count(Fax, Fax.patient_id.is_(None)),
            "intake_needing_review": await count(PortalIntakeSubmission, PortalIntakeSubmission.status.in_([PortalIntakeStatus.received, PortalIntakeStatus.needs_review])),
        },
        "billing": {
            "draft_cases": await count(BillingCase, BillingCase.status == BillingStatus.draft),
            "denied_cases": await count(BillingCase, BillingCase.status == BillingStatus.denied),
        },
    }
