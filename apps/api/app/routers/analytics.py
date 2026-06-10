from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.billing import BillingCase, BillingStatus
from app.models.fax import Fax
from app.models.integration_event import IntegrationEvent, IntegrationEventStatus
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
from app.models.portal_intake import PortalIntakeStatus, PortalIntakeSubmission
from app.models.schedule import Appointment, AppointmentStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.services import billing_service
from app.services.pilot_seed_service import seed_pilot_workspace
from app.services.readiness_service import check_readiness

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.get("/summary")
async def summary(db: DbDep, current_user: CurrentUserDep):
    org = current_user.organization_id

    async def count(model, *clauses) -> int:
        result = await db.execute(
            select(func.count(model.id)).where(model.organization_id == org, *clauses)
        )
        return result.scalar() or 0

    return {
        "schedule": {
            "scheduled": await count(
                Appointment, Appointment.status == AppointmentStatus.scheduled
            ),
            "active": await count(
                Appointment,
                Appointment.status.in_(
                    [
                        AppointmentStatus.checked_in,
                        AppointmentStatus.roomed,
                        AppointmentStatus.provider_review,
                        AppointmentStatus.checkout,
                    ]
                ),
            ),
            "no_show": await count(Appointment, Appointment.status == AppointmentStatus.no_show),
        },
        "work": {
            "open_tasks": await count(
                Task, Task.status.in_([TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked])
            ),
            "documents_needing_review": await count(
                PatientDocument, PatientDocument.status == PatientDocumentStatus.needs_review
            ),
            "unsigned_encounters": await count(
                PatientEncounter,
                PatientEncounter.status.in_(
                    [EncounterStatus.draft, EncounterStatus.provider_review]
                ),
            ),
        },
        "front_office": {
            "unmatched_faxes": await count(Fax, Fax.patient_id.is_(None)),
            "intake_needing_review": await count(
                PortalIntakeSubmission,
                PortalIntakeSubmission.status.in_(
                    [PortalIntakeStatus.received, PortalIntakeStatus.needs_review]
                ),
            ),
        },
        "billing": {
            "draft_cases": await count(BillingCase, BillingCase.status == BillingStatus.draft),
            "denied_cases": await count(BillingCase, BillingCase.status == BillingStatus.denied),
        },
    }


@router.get("/daily-closeout")
async def daily_closeout(db: DbDep, current_user: CurrentUserDep):
    org = current_user.organization_id
    now = datetime.now(UTC).replace(tzinfo=None)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    task_aging_threshold = now - timedelta(hours=48)
    document_aging_threshold = now - timedelta(hours=72)

    async def count(model, *clauses) -> int:
        result = await db.execute(
            select(func.count(model.id)).where(model.organization_id == org, *clauses)
        )
        return result.scalar() or 0

    open_task_clause = Task.status.in_(
        [TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]
    )
    billing = await billing_service.work_queue(db, current_user)
    totals = {
        "appointments_today": await count(
            Appointment,
            Appointment.start_time >= today_start,
            Appointment.start_time < tomorrow_start,
        ),
        "active_visits": await count(
            Appointment,
            Appointment.status.in_(
                [
                    AppointmentStatus.checked_in,
                    AppointmentStatus.roomed,
                    AppointmentStatus.provider_review,
                    AppointmentStatus.checkout,
                ]
            ),
        ),
        "open_tasks": await count(Task, open_task_clause),
        "overdue_tasks": await count(Task, open_task_clause, Task.due_date < now),
        "urgent_tasks": await count(Task, open_task_clause, Task.priority == TaskPriority.urgent),
        "documents_needing_review": await count(
            PatientDocument,
            PatientDocument.status == PatientDocumentStatus.needs_review,
        ),
        "unsigned_encounters": await count(
            PatientEncounter,
            PatientEncounter.status.in_([EncounterStatus.draft, EncounterStatus.provider_review]),
        ),
        "medications_needing_review": await count(
            PatientMedication,
            PatientMedication.status == MedicationStatus.review,
        ),
        "labs_needing_review": await count(
            PatientLabResult,
            PatientLabResult.status.in_([LabResultStatus.new, LabResultStatus.needs_review]),
        ),
        "care_plan_blockers": await count(
            PatientCarePlanItem,
            PatientCarePlanItem.status == CarePlanStatus.blocked,
        ),
        "intake_needing_review": await count(
            PortalIntakeSubmission,
            PortalIntakeSubmission.status.in_(
                [
                    PortalIntakeStatus.received,
                    PortalIntakeStatus.needs_review,
                ]
            ),
        ),
        "unmatched_faxes": await count(Fax, Fax.patient_id.is_(None)),
        "failed_integrations": await count(
            IntegrationEvent,
            IntegrationEvent.status == IntegrationEventStatus.failed,
        ),
    }
    aging = {
        "tasks_over_48h": await count(
            Task,
            open_task_clause,
            Task.due_date.is_not(None),
            Task.due_date <= task_aging_threshold,
        ),
        "documents_over_72h": await count(
            PatientDocument,
            PatientDocument.status == PatientDocumentStatus.needs_review,
            PatientDocument.received_at <= document_aging_threshold,
        ),
        "draft_billing_cases": billing["draft_count"],
        "denials_waiting_rework": billing["denial_rework_count"],
        "remittance_pending": billing["remittance_pending_count"],
        "failed_integration_events": totals["failed_integrations"],
    }
    risk_register = [
        _risk(
            "Urgent open tasks",
            totals["urgent_tasks"],
            "clinical",
            "Open urgent tasks should be owned before closeout.",
        ),
        _risk(
            "Overdue work",
            totals["overdue_tasks"],
            "operations",
            "Overdue tasks remain unresolved.",
        ),
        _risk(
            "Aging documents",
            aging["documents_over_72h"],
            "clinical",
            "Outside documents have waited more than 72 hours for review.",
        ),
        _risk(
            "Unsigned encounters",
            totals["unsigned_encounters"],
            "clinical",
            "Draft or provider-review encounters are blocking downstream work.",
        ),
        _risk(
            "Clinical review blockers",
            totals["medications_needing_review"]
            + totals["labs_needing_review"]
            + totals["care_plan_blockers"],
            "clinical",
            "Medication, lab, or care-plan items still need provider/nursing resolution.",
        ),
        _risk(
            "Billing coding gaps",
            billing["missing_coding_count"],
            "revenue",
            "Claims are missing CPT or diagnosis coding.",
        ),
        _risk(
            "Integration failures",
            totals["failed_integrations"],
            "vendor",
            "Failed integration events need retry or vendor follow-up.",
        ),
    ]
    risk_register = [item for item in risk_register if item["count"] > 0]
    recommended_actions = _daily_closeout_actions(totals, aging, billing)
    return {
        "status": "clear" if not risk_register else "attention",
        "generated_at": datetime.now(UTC).isoformat(),
        "totals": totals,
        "aging": aging,
        "billing": billing,
        "risk_register": risk_register,
        "recommended_actions": recommended_actions,
    }


@router.get("/pilot-readiness")
async def pilot_readiness(db: DbDep, current_user: CurrentUserDep):
    org = current_user.organization_id

    async def count(model, *clauses) -> int:
        result = await db.execute(
            select(func.count(model.id)).where(model.organization_id == org, *clauses)
        )
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
        {
            "key": "patients",
            "label": "Patient chart demo data",
            "ready": patients > 0,
            "detail": f"{patients} patients",
        },
        {
            "key": "users",
            "label": "Role-based staff demo data",
            "ready": users >= 4,
            "detail": f"{users} users",
        },
        {
            "key": "schedule",
            "label": "Scheduling workflow data",
            "ready": appointments > 0,
            "detail": f"{appointments} appointments",
        },
        {
            "key": "documents",
            "label": "Document workflow data",
            "ready": documents > 0,
            "detail": f"{documents} documents",
        },
        {
            "key": "front_office",
            "label": "Fax/intake front-office workflows",
            "ready": faxes > 0 and intake > 0,
            "detail": f"{faxes} faxes, {intake} intake submissions",
        },
        {
            "key": "billing",
            "label": "Billing workflow data",
            "ready": billing > 0,
            "detail": f"{billing} billing cases",
        },
        {
            "key": "integrations",
            "label": "Integration event trail",
            "ready": integration_events > 0,
            "detail": f"{integration_events} integration events",
        },
    ]
    pilot_items = [
        {
            "key": "core",
            "label": "Core API dependency",
            "ready": True,
            "detail": "authenticated API and database query succeeded",
        },
        {
            "key": "deployment_assets",
            "label": "Deployment and backup assets",
            "ready": all(
                item.get("ok")
                for key, item in readiness["deployment"].items()
                if key
                in {
                    "production_env_template",
                    "deployment_runbook",
                    "health_report_script",
                    "local_backup_script",
                }
            ),
            "detail": "templates/scripts present",
        },
        {
            "key": "roles",
            "label": "Minimum clinic roles",
            "ready": users >= 4,
            "detail": f"{users} active users",
        },
        {
            "key": "audit",
            "label": "Audit-visible workflows",
            "ready": integration_events > 0,
            "detail": f"{integration_events} integration events",
        },
        {
            "key": "operational_queues",
            "label": "Operational queues seeded",
            "ready": tasks > 0 and appointments > 0,
            "detail": f"{tasks} tasks, {appointments} appointments",
        },
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


@router.get("/presales-saas-readiness")
async def presales_saas_readiness(db: DbDep, current_user: CurrentUserDep):
    org = current_user.organization_id

    async def count(model, *clauses) -> int:
        result = await db.execute(
            select(func.count(model.id)).where(model.organization_id == org, *clauses)
        )
        return result.scalar() or 0

    readiness = await check_readiness()
    pilot = await pilot_readiness(db, current_user)
    users = await count(User)
    patients = await count(Patient)
    appointments = await count(Appointment)
    tasks = await count(Task)
    documents = await count(PatientDocument)
    faxes = await count(Fax)
    intake = await count(PortalIntakeSubmission)
    billing = await count(BillingCase)
    integration_events = await count(IntegrationEvent)

    deployment = readiness.get("deployment", {})
    deployment_ready = all(
        deployment.get(key, {}).get("ok")
        for key in (
            "production_env_template",
            "deployment_runbook",
            "health_report_script",
            "local_backup_script",
        )
    )
    demo_data_ready = all(
        count_value > 0
        for count_value in (patients, appointments, tasks, documents, faxes, intake, billing)
    )
    integration_framework_ready = integration_events > 0 and bool(readiness.get("integrations"))
    features = [
        {
            "key": "production_like_infrastructure",
            "label": "Production-like app infrastructure",
            "ready": deployment_ready,
            "status": "ready" if deployment_ready else "needs_setup",
            "detail": (
                "Deployment templates, health report, backup script, and runbook are local-ready."
            ),
            "self_service_next_step": (
                "Provision a staging host with managed Postgres, Redis, object storage, "
                "logs, alerts, and backups."
            ),
            "customer_credentials_required": False,
            "future_customer_inputs": ["Customer BAA and production DNS after sale"],
        },
        {
            "key": "saas_account_model",
            "label": "SaaS account model",
            "ready": users > 0,
            "status": "ready" if users > 0 else "needs_setup",
            "detail": f"Organization-scoped users exist for this workspace: {users}.",
            "self_service_next_step": (
                "Use synthetic organizations and staff roles for trial workspaces."
            ),
            "customer_credentials_required": False,
            "future_customer_inputs": ["Real clinic staff roster and identity policy after sale"],
        },
        {
            "key": "sales_demo_workspace",
            "label": "Sales demo workspace",
            "ready": demo_data_ready,
            "status": "ready" if demo_data_ready else "needs_seed",
            "detail": (
                f"Synthetic counts: {patients} patients, {appointments} appointments, "
                f"{tasks} tasks, {documents} documents, {faxes} faxes, {intake} intake, "
                f"{billing} billing cases."
            ),
            "self_service_next_step": (
                "Run the pilot seed action from Setup to create a complete synthetic clinic."
            ),
            "customer_credentials_required": False,
            "future_customer_inputs": ["Real migration files only after customer purchase"],
        },
        {
            "key": "vendor_neutral_integrations",
            "label": "Vendor-neutral integration framework",
            "ready": integration_framework_ready,
            "status": "ready" if integration_framework_ready else "needs_demo_events",
            "detail": (
                "Sandbox and credential-preflight lanes can show what each vendor needs later."
            ),
            "self_service_next_step": (
                "Keep vendor lanes in sandbox/placeholder mode and show missing credential status."
            ),
            "customer_credentials_required": False,
            "future_customer_inputs": [
                "Fax, clearinghouse, labs, eRx, payments, communications, and identity credentials"
            ],
        },
        {
            "key": "native_ai_functionality",
            "label": "Native AI functionality",
            "ready": settings.native_ai_commands_enabled,
            "status": "ready" if settings.native_ai_commands_enabled else "disabled",
            "detail": "Typed and voice commands can stage proposals against synthetic data.",
            "self_service_next_step": (
                "Use the command palette in demo mode for AI-guided workflow walkthroughs."
            ),
            "customer_credentials_required": False,
            "future_customer_inputs": ["Approved model/transcription policy before live PHI use"],
        },
        {
            "key": "sales_admin_readiness",
            "label": "Sales/admin readiness",
            "ready": pilot["product_demo_score"] >= 80,
            "status": "ready" if pilot["product_demo_score"] >= 80 else "needs_demo_setup",
            "detail": f"Product demo score is {pilot['product_demo_score']}%.",
            "self_service_next_step": (
                "Use Setup, Operations, and demo reset tools for repeatable sales walkthroughs."
            ),
            "customer_credentials_required": False,
            "future_customer_inputs": [
                "Pricing, contracts, BAA countersignature, and launch owner after sale"
            ],
        },
        {
            "key": "compliance_prep",
            "label": "Compliance prep without PHI",
            "ready": True,
            "status": "ready",
            "detail": (
                "Policy, audit, retention, backup, incident, and launch evidence surfaces "
                "are available without live PHI."
            ),
            "self_service_next_step": (
                "Review policy drafts and run backup/restore drills in staging."
            ),
            "customer_credentials_required": False,
            "future_customer_inputs": ["Clinic legal/compliance approval before live PHI"],
        },
    ]

    ready_count = sum(1 for feature in features if feature["ready"])
    score = round(ready_count / len(features) * 100)
    return {
        "status": "ready_for_demo" if score >= 85 else "needs_demo_setup",
        "score": score,
        "ready_count": ready_count,
        "total": len(features),
        "customer_credentials_required": False,
        "features": features,
        "external_blockers": [
            "Production clinic BAA, DNS, and account ownership",
            "Real staff roster and identity/MFA policy",
            "DrChrono export/API access and migration sign-off",
            "Vendor credentials and enrollment approvals",
            "Clinic workflow validation, training, and go-live sign-off",
        ],
        "generated_at": datetime.now(UTC).isoformat(),
    }


@router.post("/pilot-readiness/seed", status_code=status.HTTP_201_CREATED)
async def seed_pilot_readiness(
    db: DbDep,
    current_user: User = Depends(require_roles(UserRole.admin)),  # noqa: B008
):
    if not settings.allow_seed_endpoint or settings.is_production:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return await seed_pilot_workspace(db, current_user)


def _risk(label: str, count: int, category: str, detail: str) -> dict:
    severity = "critical" if category in {"clinical", "vendor"} and count > 0 else "warning"
    return {
        "label": label,
        "category": category,
        "count": count,
        "severity": severity,
        "detail": detail,
    }


def _daily_closeout_actions(totals: dict, aging: dict, billing: dict) -> list[dict]:
    actions = []
    if totals["urgent_tasks"] > 0:
        actions.append(
            {
                "key": "urgent_tasks",
                "severity": "critical",
                "label": "Assign or complete urgent tasks",
                "detail": f"{totals['urgent_tasks']} urgent task(s) are still open.",
                "route": "/tasks",
            }
        )
    if aging["documents_over_72h"] > 0:
        actions.append(
            {
                "key": "documents_over_72h",
                "severity": "critical",
                "label": "Review aging outside documents",
                "detail": f"{aging['documents_over_72h']} document(s) have aged past 72 hours.",
                "route": "/patients",
            }
        )
    if totals["unsigned_encounters"] > 0:
        actions.append(
            {
                "key": "unsigned_encounters",
                "severity": "warning",
                "label": "Close unsigned encounters",
                "detail": (
                    f"{totals['unsigned_encounters']} encounter(s) remain draft or in "
                    "provider review."
                ),
                "route": "/patients",
            }
        )
    clinical_review_count = (
        totals["medications_needing_review"]
        + totals["labs_needing_review"]
        + totals["care_plan_blockers"]
    )
    if clinical_review_count > 0:
        actions.append(
            {
                "key": "clinical_review",
                "severity": "critical",
                "label": "Resolve clinical review blockers",
                "detail": (
                    f"{clinical_review_count} medication, lab, or care-plan item(s) "
                    "need resolution before closeout."
                ),
                "route": "/patients",
            }
        )
    if billing["missing_coding_count"] > 0:
        actions.append(
            {
                "key": "billing_coding",
                "severity": "warning",
                "label": "Resolve billing coding gaps",
                "detail": (
                    f"{billing['missing_coding_count']} claim(s) are missing coding "
                    "before submission."
                ),
                "route": "/billing",
            }
        )
    if totals["failed_integrations"] > 0:
        actions.append(
            {
                "key": "failed_integrations",
                "severity": "warning",
                "label": "Retry failed integration events",
                "detail": f"{totals['failed_integrations']} vendor event(s) failed.",
                "route": "/operations",
            }
        )
    if totals["intake_needing_review"] > 0:
        actions.append(
            {
                "key": "portal_intake",
                "severity": "normal",
                "label": "Clear portal intake review",
                "detail": f"{totals['intake_needing_review']} intake submission(s) need review.",
                "route": "/portal-intake",
            }
        )
    return actions
