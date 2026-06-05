from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.billing import BillingCase, BillingStatus
from app.models.fax import Fax
from app.models.patient import Patient
from app.models.patient_clinical import EncounterStatus, PatientEncounter
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.portal_intake import PortalIntakeStatus, PortalIntakeSubmission
from app.models.schedule import Appointment, AppointmentStatus
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.models.integration_event import IntegrationEvent
from app.services.readiness_service import check_readiness
from app.services.pilot_seed_service import seed_pilot_workspace

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


@router.get("/pilot-readiness")
async def pilot_readiness(db: DbDep, current_user: CurrentUserDep):
    org = current_user.organization_id

    async def count(model, *clauses) -> int:
        result = await db.execute(select(func.count(model.id)).where(model.organization_id == org, *clauses))
        return result.scalar() or 0

    readiness = await check_readiness()
    patients = await count(Patient)
    users = await count(User)
    tasks = await count(Task)
    appointments = await count(Appointment)
    documents = await count(PatientDocument)
    faxes = await count(Fax)
    intake = await count(PortalIntakeSubmission)
    billing = await count(BillingCase)
    integration_events = await count(IntegrationEvent)
    demo_items = [
        {"key": "patients", "label": "Patient chart demo data", "ready": patients > 0, "detail": f"{patients} patients"},
        {"key": "users", "label": "Role-based staff demo data", "ready": users >= 4, "detail": f"{users} users"},
        {"key": "schedule", "label": "Scheduling workflow data", "ready": appointments > 0, "detail": f"{appointments} appointments"},
        {"key": "documents", "label": "Document workflow data", "ready": documents > 0, "detail": f"{documents} documents"},
        {"key": "front_office", "label": "Fax/intake front-office workflows", "ready": faxes > 0 and intake > 0, "detail": f"{faxes} faxes, {intake} intake submissions"},
        {"key": "billing", "label": "Billing workflow data", "ready": billing > 0, "detail": f"{billing} billing cases"},
        {"key": "integrations", "label": "Integration event trail", "ready": integration_events > 0, "detail": f"{integration_events} integration events"},
    ]
    pilot_items = [
        {"key": "core", "label": "Core API dependency", "ready": True, "detail": "authenticated API and database query succeeded"},
        {"key": "deployment_assets", "label": "Deployment and backup assets", "ready": all(item.get("ok") for key, item in readiness["deployment"].items() if key in {"production_env_template", "deployment_runbook", "health_report_script", "local_backup_script"}), "detail": "templates/scripts present"},
        {"key": "roles", "label": "Minimum clinic roles", "ready": users >= 4, "detail": f"{users} active users"},
        {"key": "audit", "label": "Audit-visible workflows", "ready": integration_events > 0, "detail": f"{integration_events} integration events"},
        {"key": "operational_queues", "label": "Operational queues seeded", "ready": tasks > 0 and appointments > 0, "detail": f"{tasks} tasks, {appointments} appointments"},
    ]

    def score(items: list[dict]) -> int:
        if not items:
            return 0
        return round(sum(1 for item in items if item["ready"]) / len(items) * 100)

    product_demo_score = score(demo_items)
    internal_pilot_score = score(pilot_items)
    return {
        "product_demo_score": product_demo_score,
        "internal_pilot_score": internal_pilot_score,
        "product_demo_ready": product_demo_score == 100,
        "internal_pilot_ready": internal_pilot_score == 100,
        "demo_items": demo_items,
        "pilot_items": pilot_items,
        "generated_at": datetime.now(UTC).isoformat(),
    }


@router.post("/pilot-readiness/seed", status_code=status.HTTP_201_CREATED)
async def seed_pilot_readiness(db: DbDep, current_user: CurrentUserDep):
    return await seed_pilot_workspace(db, current_user)
