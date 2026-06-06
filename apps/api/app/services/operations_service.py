from copy import deepcopy
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.integration_event import IntegrationEvent, IntegrationEventStatus
from app.models.patient_clinical import EncounterStatus, PatientEncounter
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.config import (
    DEFAULT_MINIO_ACCESS_KEY,
    DEFAULT_MINIO_SECRET_KEY,
    DEFAULT_SECRET_KEY,
    settings,
)
from app.services import integration_config_service, user_service
from app.services.audit_service import log_event
from app.services.launch_readiness_service import launch_readiness
from app.services import patient_document_service
from app.services.readiness_service import check_readiness

SNAPSHOT_EVENT_TYPE = "operations.readiness_snapshot"
REHEARSAL_SNAPSHOT_EVENT_TYPE = "operations.production_rehearsal_snapshot"
REHEARSAL_ASSIGNMENT_EVENT_TYPE = "operations.rehearsal_action_assignment"
LAUNCH_WORKPLAN_SNAPSHOT_EVENT_TYPE = "operations.launch_workplan_snapshot"
GO_LIVE_ATTESTATION_EVENT_TYPE = "operations.go_live_packet_attestation"
ROLE_DRY_RUN_SESSION_EVENT_TYPE = "operations.role_dry_run_session"
BROWSER_QA_SESSION_EVENT_TYPE = "operations.browser_qa_session"
STAFF_TRAINING_SESSION_EVENT_TYPE = "operations.staff_training_session"
POLICY_APPROVAL_SESSION_EVENT_TYPE = "operations.policy_approval_session"
CUTOVER_RUNBOOK_SESSION_EVENT_TYPE = "operations.cutover_runbook_session"
RESTORE_DRILL_SESSION_EVENT_TYPE = "operations.restore_drill_session"


async def incident_register(db: AsyncSession, user: User) -> dict:
    readiness = await check_readiness()
    launch = await launch_readiness()
    incidents = []
    incidents.extend(_readiness_incidents(readiness))
    incidents.extend(_launch_incidents(launch))
    incidents.extend(await _integration_event_incidents(db, user))
    deduped = _dedupe_incidents(incidents)
    return {
        "data": deduped,
        "open_count": len(deduped),
        "critical_count": sum(1 for item in deduped if item["severity"] == "critical"),
        "warning_count": sum(1 for item in deduped if item["severity"] == "warning"),
        "generated_at": datetime.now(UTC),
    }


async def incident_timeline(db: AsyncSession, user: User, limit: int = 30) -> dict:
    items: list[dict] = []
    failed_events = (
        await db.execute(
            select(IntegrationEvent)
            .where(
                IntegrationEvent.organization_id == user.organization_id,
                IntegrationEvent.status == IntegrationEventStatus.failed,
            )
            .order_by(IntegrationEvent.updated_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    for event in failed_events:
        items.append({
            "key": f"integration_event:{event.integration}:{event.action}",
            "occurred_at": event.updated_at,
            "severity": "critical",
            "category": "integration",
            "title": f"{event.integration.replace('_', ' ').title()} failed",
            "detail": event.error or f"{event.action} failed after {event.attempts} attempt(s).",
            "source": "integration_events",
            "route": "/operations",
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
        })

    sensitive_event_types = [
        "auth.login_blocked",
        "user.password_reset_issued",
        "auth.password_rotated",
        "audit.exported",
        "patient_document.download_handoff",
        "patient_document.accessed",
        "integration_event.retry",
    ]
    audit_events = (
        await db.execute(
            select(AuditLog)
            .where(
                AuditLog.organization_id == user.organization_id,
                AuditLog.event_type.in_(sensitive_event_types),
            )
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    for event in audit_events:
        items.append(_timeline_item_from_audit(event))

    sorted_items = sorted(
        items,
        key=lambda item: item["occurred_at"],
        reverse=True,
    )[:limit]
    return {
        "data": sorted_items,
        "total": len(sorted_items),
        "critical_count": sum(1 for item in sorted_items if item["severity"] == "critical"),
        "warning_count": sum(1 for item in sorted_items if item["severity"] == "warning"),
        "generated_at": datetime.now(UTC),
    }


async def alert_rules(db: AsyncSession, user: User) -> dict:
    readiness = await check_readiness()
    deployment = readiness.get("deployment", {})
    document_storage = await document_storage_readiness(db, user)
    role_matrix = await user_service.role_access_matrix(db, user)
    failed_events = (
        await db.execute(
            select(IntegrationEvent)
            .where(
                IntegrationEvent.organization_id == user.organization_id,
                IntegrationEvent.status == IntegrationEventStatus.failed,
            )
            .order_by(IntegrationEvent.updated_at.desc())
        )
    ).scalars().all()
    blocked_logins = (
        await db.execute(
            select(AuditLog)
            .where(
                AuditLog.organization_id == user.organization_id,
                AuditLog.event_type == "auth.login_blocked",
            )
            .order_by(AuditLog.created_at.desc())
        )
    ).scalars().all()
    document_access = (
        await db.execute(
            select(AuditLog)
            .where(
                AuditLog.organization_id == user.organization_id,
                AuditLog.event_type.in_(["patient_document.accessed", "patient_document.download_handoff"]),
            )
            .order_by(AuditLog.created_at.desc())
        )
    ).scalars().all()
    audit_exports = (
        await db.execute(
            select(AuditLog)
            .where(
                AuditLog.organization_id == user.organization_id,
                AuditLog.event_type == "audit.exported",
            )
            .order_by(AuditLog.created_at.desc())
        )
    ).scalars().all()
    recovery = await user_service.recovery_summary(db, user)
    backup_ok = bool(deployment.get("latest_backup", {}).get("ok"))
    restore_ok = bool(deployment.get("latest_restore", {}).get("ok"))

    rules = [
        _alert_rule(
            "failed_integrations",
            "Failed integrations",
            bool(failed_events),
            "critical",
            len(failed_events),
            failed_events[0].error if failed_events and failed_events[0].error else f"{len(failed_events)} failed integration event(s).",
            "/operations",
            failed_events[0].updated_at if failed_events else None,
        ),
        _alert_rule(
            "blocked_logins",
            "Blocked logins",
            bool(blocked_logins),
            "critical",
            len(blocked_logins),
            _blocked_login_detail(blocked_logins),
            "/staff",
            blocked_logins[0].created_at if blocked_logins else None,
        ),
        _alert_rule(
            "expired_onboarding",
            "Expired onboarding credentials",
            recovery["expired_temporary_password_count"] > 0,
            "warning",
            recovery["expired_temporary_password_count"],
            f"{recovery['expired_temporary_password_count']} expired temporary credential(s).",
            "/staff",
            None,
        ),
        _alert_rule(
            "backup_restore_gap",
            "Backup and restore gap",
            not (backup_ok and restore_ok),
            "warning",
            0 if backup_ok and restore_ok else 1,
            _backup_restore_detail(deployment),
            "/operations",
            deployment.get("latest_restore", {}).get("last_success_at")
            or deployment.get("latest_backup", {}).get("last_success_at"),
        ),
        _alert_rule(
            "document_access_review",
            "Document access review",
            bool(document_access),
            "warning",
            len(document_access),
            f"{len(document_access)} document access event(s) should be reviewed before closeout.",
            "/operations",
            document_access[0].created_at if document_access else None,
        ),
        _alert_rule(
            "audit_export_review",
            "Audit export review",
            bool(audit_exports),
            "warning",
            len(audit_exports),
            _audit_export_detail(audit_exports),
            "/operations",
            audit_exports[0].created_at if audit_exports else None,
        ),
        _alert_rule(
            "document_storage_readiness",
            "Document storage readiness",
            document_storage["status"] != "ready",
            "critical" if document_storage["status"] == "blocked" else "warning",
            document_storage["summary"]["config_gaps"]
            + document_storage["summary"]["metadata_only_documents"]
            + document_storage["summary"]["unsigned_handoffs"]
            + document_storage["summary"]["expired_handoffs"],
            _document_storage_alert_detail(document_storage),
            "/operations",
            document_storage["recent_handoffs"][0]["occurred_at"]
            if document_storage["recent_handoffs"]
            else None,
        ),
        _alert_rule(
            "role_access_matrix",
            "Role access matrix",
            bool(role_matrix["warnings"]),
            _role_access_severity(role_matrix),
            len(role_matrix["warnings"]),
            _role_access_detail(role_matrix),
            "/staff",
            role_matrix["generated_at"] if role_matrix["warnings"] else None,
        ),
    ]
    return {
        "data": rules,
        "total": len(rules),
        "triggered_count": sum(1 for item in rules if item["status"] == "triggered"),
        "critical_count": sum(1 for item in rules if item["status"] == "triggered" and item["severity"] == "critical"),
        "warning_count": sum(1 for item in rules if item["status"] == "triggered" and item["severity"] == "warning"),
        "generated_at": datetime.now(UTC),
    }


async def document_storage_readiness(db: AsyncSession, user: User) -> dict:
    total_documents = (
        await db.execute(
            select(func.count(PatientDocument.id)).where(
                PatientDocument.organization_id == user.organization_id,
            )
        )
    ).scalar() or 0
    metadata_only_documents = (
        await db.execute(
            select(func.count(PatientDocument.id)).where(
                PatientDocument.organization_id == user.organization_id,
                or_(
                    PatientDocument.file_url.is_(None),
                    PatientDocument.file_url == "",
                    PatientDocument.upload_status == "metadata_only",
                ),
            )
        )
    ).scalar() or 0
    stored_documents = max(0, total_documents - metadata_only_documents)
    handoff_events = (
        await db.execute(
            select(AuditLog)
            .where(
                AuditLog.organization_id == user.organization_id,
                AuditLog.event_type.in_(["patient_document.accessed", "patient_document.download_handoff"]),
            )
            .order_by(AuditLog.created_at.desc())
            .limit(200)
        )
    ).scalars().all()

    recent_handoffs = [_document_storage_handoff(event) for event in handoff_events]
    unsigned_handoffs = sum(
        1
        for item in recent_handoffs
        if item["storage_status"] == "signed_handoff" and not item["presigned"]
    )
    expired_handoffs = sum(1 for item in recent_handoffs if item["expired"])
    config_gaps = _document_storage_config_gap_count()
    signing_gaps = 2 if config_gaps else _document_storage_signing_gap_count()

    checks = [
        _document_storage_check(
            "object_storage_credentials",
            "Object-storage credentials",
            config_gaps,
            "critical",
            "Production object storage is not fully configured with secure, non-default credentials."
            if config_gaps
            else "Object storage credentials and secure transport are configured.",
            "Set production MINIO/S3 endpoint, bucket, access key, secret key, and secure transport.",
        ),
        _document_storage_check(
            "object_storage_signing",
            "Object-storage signing",
            signing_gaps,
            "critical",
            f"{signing_gaps} object-storage signing path(s) failed a presigned URL capability check."
            if signing_gaps
            else "Upload and download signing paths can produce presigned URLs.",
            "Verify upload and download presigning against the production bucket before go-live.",
        ),
        _document_storage_check(
            "metadata_only_documents",
            "Metadata-only documents",
            metadata_only_documents,
            "warning",
            f"{metadata_only_documents} document(s) do not have a file URL attached.",
            "Upload or reconcile missing files before relying on document previews/downloads.",
        ),
        _document_storage_check(
            "unsigned_handoffs",
            "Unsigned object handoffs",
            unsigned_handoffs,
            "warning",
            f"{unsigned_handoffs} recent handoff(s) did not receive a presigned object-storage URL.",
            "Verify object-storage signing is reachable and configured before go-live.",
        ),
        _document_storage_check(
            "expired_handoffs",
            "Expired signed handoffs",
            expired_handoffs,
            "warning",
            f"{expired_handoffs} signed handoff(s) are expired and should be regenerated on demand.",
            "Have staff request a fresh document access link when the original handoff expires.",
        ),
    ]
    critical = sum(1 for check in checks if check["status"] == "triggered" and check["severity"] == "critical")
    warnings = sum(1 for check in checks if check["status"] == "triggered" and check["severity"] == "warning")
    score = max(0, 100 - critical * 35 - warnings * 15)
    return {
        "status": "blocked" if critical else "attention" if warnings else "ready",
        "score": score,
        "generated_at": datetime.now(UTC),
        "summary": {
            "total_documents": total_documents,
            "stored_documents": stored_documents,
            "metadata_only_documents": metadata_only_documents,
            "recent_handoffs": len(recent_handoffs),
            "unsigned_handoffs": unsigned_handoffs,
            "expired_handoffs": expired_handoffs,
            "config_gaps": config_gaps,
            "signing_gaps": signing_gaps,
        },
        "checks": checks,
        "recent_handoffs": recent_handoffs[:10],
    }


async def operator_health(db: AsyncSession, user: User) -> dict:
    readiness = await check_readiness()
    preflight = await integration_config_service.credential_preflight(db, user)
    packet = await go_live_packet(db, user)
    failed_integrations = await _integration_failure_health(db, user)
    role_matrix = await user_service.role_access_matrix(db, user)
    deployment = readiness.get("deployment", {})
    missing_evidence = sum(1 for item in packet["evidence"] if item["status"] == "missing")
    blocking_evidence = sum(1 for item in packet["evidence"] if item["status"] == "blocking")
    warning_evidence = sum(1 for item in packet["evidence"] if item["status"] == "warning")

    checks = [
        _operator_check(
            "core_readiness",
            "Core readiness",
            "healthy" if readiness.get("status") == "ok" else "critical",
            100 if readiness.get("status") == "ok" else 0,
            f"Core infrastructure status is {readiness.get('status', 'unknown')}.",
            "/operations",
        ),
        _operator_check(
            "operational_readiness",
            "Operational readiness",
            "healthy" if readiness.get("operational_status") == "ok" else "critical",
            100 if readiness.get("operational_status") == "ok" else 25,
            f"Operational readiness is {readiness.get('operational_status', 'unknown')}.",
            "/integrations",
        ),
        _freshness_check(
            "backup_freshness",
            "Backup freshness",
            deployment.get("latest_backup", {}),
            stale_after=timedelta(days=1),
            missing_status="critical",
            route="/operations",
        ),
        _freshness_check(
            "restore_freshness",
            "Restore validation freshness",
            deployment.get("latest_restore", {}),
            stale_after=timedelta(days=30),
            missing_status="warning",
            route="/operations",
        ),
        failed_integrations,
        _operator_check(
            "credential_preflight",
            "Credential preflight",
            "critical"
            if preflight["blocking_count"]
            else "warning"
            if preflight["staged_count"]
            else "healthy",
            max(0, 100 - preflight["blocking_count"] * 20 - preflight["staged_count"] * 8),
            f"{preflight['blocking_count']} blocking and {preflight['staged_count']} staged integration item(s).",
            "/integrations",
        ),
        _operator_check(
            "launch_evidence",
            "Launch evidence",
            "critical"
            if blocking_evidence or missing_evidence
            else "warning"
            if warning_evidence
            else "healthy",
            max(0, 100 - (blocking_evidence + missing_evidence) * 20 - warning_evidence * 10),
            f"{missing_evidence} missing, {blocking_evidence} blocking, and {warning_evidence} warning evidence item(s).",
            "/operations",
        ),
        _role_access_health(role_matrix),
    ]
    critical = sum(1 for check in checks if check["status"] == "critical")
    warning = sum(1 for check in checks if check["status"] == "warning")
    score = round(sum(check["score"] for check in checks) / len(checks)) if checks else 0
    recommended_actions = [
        _operator_action(check)
        for check in checks
        if check["status"] != "healthy"
    ]
    return {
        "status": "critical" if critical else "attention" if warning else "healthy",
        "score": score,
        "generated_at": datetime.now(UTC),
        "summary": {
            "critical_checks": critical,
            "warning_checks": warning,
            "failed_integration_events": failed_integrations["failed_count"],
            "credential_blockers": preflight["blocking_count"],
            "launch_evidence_missing": missing_evidence,
            "role_access_warnings": len(role_matrix["warnings"]),
            "privileged_mfa_gaps": role_matrix["summary"]["privileged_users_without_mfa"],
            "roles_without_active_users": role_matrix["summary"]["roles_without_active_users"],
        },
        "checks": checks,
        "recommended_actions": recommended_actions,
    }


def production_config_audit() -> dict:
    checks = [
        _config_check(
            "app_env",
            "Infrastructure",
            "Production environment mode",
            settings.is_production,
            "warning",
            f"Current APP_ENV is {settings.app_env}.",
            "Set APP_ENV=production in the production secret store.",
            ["APP_ENV"],
            ["docs/operations/production-launch-checklist.md"],
        ),
        _config_check(
            "secret_key",
            "Security",
            "Unique API signing secret",
            settings.secret_key != DEFAULT_SECRET_KEY and len(settings.secret_key) >= 32,
            "critical",
            "JWT signing must use a unique production secret of at least 32 characters.",
            "Generate and store a new SECRET_KEY; never reuse the development default.",
            ["SECRET_KEY"],
            [".env.production.example"],
        ),
        _config_check(
            "cors_origins",
            "Security",
            "Production HTTPS CORS origins",
            _cors_origins_are_production_safe(),
            "critical",
            f"Configured CORS origins: {', '.join(settings.cors_origin_list) or 'none'}.",
            "Set CORS_ORIGINS to only the production HTTPS app origin(s).",
            ["CORS_ORIGINS"],
            ["docs/operations/production-launch-checklist.md"],
        ),
        _config_check(
            "seed_endpoints",
            "Security",
            "Seed endpoints disabled",
            not settings.allow_seed_endpoint,
            "critical",
            "Seed endpoints can create local/demo users and pilot data.",
            "Set ALLOW_SEED_ENDPOINT=false before production launch.",
            ["ALLOW_SEED_ENDPOINT"],
            ["docs/operations/production-launch-checklist.md"],
        ),
        _config_check(
            "schema_migrations",
            "Infrastructure",
            "Explicit database migrations",
            not settings.auto_create_schema,
            "critical",
            "Production should run Alembic migrations instead of auto-creating schema.",
            "Set AUTO_CREATE_SCHEMA=false and run pnpm migrate:api during deploy.",
            ["AUTO_CREATE_SCHEMA"],
            ["scripts/migrate-api.sh", "docs/operations/deployment-runbook.md"],
        ),
        _config_check(
            "object_storage_startup",
            "Infrastructure",
            "Object storage startup enforcement",
            settings.ensure_object_storage_on_startup,
            "critical",
            "Startup should fail if object storage is missing or unreachable.",
            "Set ENSURE_OBJECT_STORAGE_ON_STARTUP=true for production.",
            ["ENSURE_OBJECT_STORAGE_ON_STARTUP"],
            ["docs/operations/production-launch-checklist.md"],
        ),
        _config_check(
            "minio_credentials",
            "Security",
            "Production object-storage credentials",
            settings.minio_access_key != DEFAULT_MINIO_ACCESS_KEY
            and settings.minio_secret_key != DEFAULT_MINIO_SECRET_KEY
            and bool(settings.minio_endpoint)
            and settings.minio_secure,
            "critical",
            "Object storage should use production credentials and secure transport.",
            "Set production MINIO/S3 endpoint, access key, secret key, bucket, and MINIO_SECURE=true.",
            ["MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET", "MINIO_SECURE"],
            [".env.production.example", "docs/operations/production-launch-checklist.md"],
        ),
        _config_check(
            "webhook_secret",
            "Security",
            "Webhook signing secret",
            bool(settings.webhook_shared_secret) and len(settings.webhook_shared_secret) >= 16,
            "critical",
            "Inbound vendor callbacks require a shared signing secret, fresh timestamp header, HMAC payload signature, and stable event id.",
            "Set WEBHOOK_SHARED_SECRET and configure vendors to send X-Concierge-Webhook-Secret, X-Concierge-Webhook-Timestamp, X-Concierge-Webhook-Signature, and event_id.",
            ["WEBHOOK_SHARED_SECRET"],
            ["docs/integrations/vendor-adapter-plan.md"],
        ),
        _config_check(
            "communications_provider",
            "Integrations",
            "Production communications provider",
            settings.communications_provider != "demo" and bool(settings.communications_provider_api_key),
            "warning",
            f"Current communications provider is {settings.communications_provider}.",
            "Select the production SMS/email/portal provider and set COMMUNICATIONS_PROVIDER_API_KEY.",
            ["COMMUNICATIONS_PROVIDER", "COMMUNICATIONS_PROVIDER_API_KEY"],
            ["docs/integrations/vendor-adapter-plan.md"],
        ),
    ]
    critical = sum(1 for check in checks if not check["ready"] and check["severity"] == "critical")
    warnings = sum(1 for check in checks if not check["ready"] and check["severity"] == "warning")
    ready_count = sum(1 for check in checks if check["ready"])
    return {
        "status": "blocked" if critical else "attention" if warnings else "ready",
        "score": round((ready_count / len(checks)) * 100) if checks else 0,
        "environment": settings.app_env,
        "generated_at": datetime.now(UTC),
        "critical_count": critical,
        "warning_count": warnings,
        "ready_count": ready_count,
        "total": len(checks),
        "checks": checks,
    }


def browser_qa_checklist() -> dict:
    items = [
        _browser_qa_item("login", "Login", "Confirm staff login and demo-mode entry load the expected workspace.", "/login", "Access"),
        _browser_qa_item("patients", "Patients", "Search patients, open a profile, and confirm chart tabs render.", "/patients", "Clinical"),
        _browser_qa_item("scheduling", "Scheduling", "Open today queue, schedule views, and conflict-check controls.", "/scheduling", "Front office"),
        _browser_qa_item("documents", "Patient documents", "Review document list, access metadata, upload flow, and filing controls from a patient chart.", "/patients", "Clinical"),
        _browser_qa_item("faxes", "Faxes", "Review inbound/outbound fax queues, matching, and status actions.", "/faxes", "Front office"),
        _browser_qa_item("billing", "Billing", "Review charge capture, claim readiness, eligibility history, and billing work queue.", "/billing", "Revenue"),
        _browser_qa_item("audit", "Audit", "Confirm audit list, patient access history, and export controls are reachable.", "/operations", "Compliance"),
        _browser_qa_item("assistant_actions", "Assistant actions", "Review confirmation-gated assistant actions and policy surface.", "/assistant-review", "AI safety"),
        _browser_qa_item("portal_intake", "Portal intake", "Process intake, appointment conversion, and document conversion workflows.", "/portal-intake", "Patient access"),
        _browser_qa_item("reports", "Reports", "Review daily closeout risks, recommended actions, and CSV export.", "/reports", "Operations"),
    ]
    return {
        "generated_at": datetime.now(UTC),
        "items": items,
        "total": len(items),
    }


async def start_browser_qa_session(db: AsyncSession, user: User, data: dict) -> dict:
    checklist = browser_qa_checklist()
    session_id = str(uuid4())
    payload = _recalculate_browser_qa_totals({
        "session_id": session_id,
        "session_name": data.get("session_name") or "Browser QA run",
        "browser": data.get("browser"),
        "status": "in_progress",
        "note": data.get("note"),
        "started_by": user.display_name,
        "completed_by": None,
        "started_at": datetime.now(UTC).isoformat(),
        "completed_at": None,
        "items": [
            {
                **item,
                "qa_status": "pending",
                "note": None,
            }
            for item in checklist["items"]
        ],
    })
    event = await log_event(
        db,
        BROWSER_QA_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _browser_qa_session_from_audit(event)


async def list_browser_qa_sessions(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == BROWSER_QA_SESSION_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(200))
    sessions: dict[str, dict] = {}
    for event in result.scalars().all():
        session = _browser_qa_session_from_audit(event)
        sessions.setdefault(session["session_id"], session)
    return list(sessions.values())[:25], len(sessions)


async def update_browser_qa_session(db: AsyncSession, user: User, session_id: str, data: dict) -> dict | None:
    latest = await _latest_browser_qa_session_event(db, user, session_id)
    if not latest:
        return None

    payload = deepcopy(latest.payload or {})
    if data.get("note") is not None:
        payload["note"] = data["note"]
    if data.get("session_status"):
        payload["status"] = data["session_status"]
        if data["session_status"] == "completed" and not payload.get("completed_at"):
            payload["completed_at"] = datetime.now(UTC).isoformat()
            payload["completed_by"] = user.display_name

    item_key = data.get("item_key")
    if item_key:
        updated = False
        for item in payload.get("items", []):
            if item.get("key") != item_key:
                continue
            if data.get("qa_status"):
                item["qa_status"] = data["qa_status"]
            if data.get("item_note") is not None:
                item["note"] = data["item_note"]
            updated = True
            break
        if not updated:
            return None

    payload = _recalculate_browser_qa_totals(payload)
    event = await log_event(
        db,
        BROWSER_QA_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _browser_qa_session_from_audit(event)


def staff_training_checklist() -> dict:
    roles = [
        _training_role("front_desk", "Front desk", "Patient access, intake, scheduling, communications, and checkout expectations.", [
            _training_item("daily_flow", "Daily workflow", "Review command center, patient lookup, scheduling, portal intake, and checkout handoff.", "/", "Workflow"),
            _training_item("access_phi", "Access and PHI", "Review patient privacy expectations, minimum necessary access, and screen discipline.", "/roles", "Compliance"),
            _training_item("escalation", "Escalation", "Review how to route patient blockers, failed outreach, and urgent front-office issues.", "/tasks", "Operations"),
        ]),
        _training_role("ma_nurse", "MA / nurse", "Clinical intake, documents, medication review, labs, care plan, and escalation expectations.", [
            _training_item("clinical_rooming", "Clinical rooming", "Review documents, medications, labs, and care-plan workflow in the patient chart.", "/patients", "Workflow"),
            _training_item("phi_audit", "PHI and audit trail", "Review audit-visible patient chart access and documentation expectations.", "/operations", "Compliance"),
            _training_item("incident_response", "Incident response", "Review escalation steps for privacy, safety, document, and integration incidents.", "/operations", "Operations"),
        ]),
        _training_role("provider", "Provider", "Clinical review, assistant confirmation, encounter signing, and checkout ownership.", [
            _training_item("provider_workflow", "Provider workflow", "Review chart blockers, documents, labs, medications, encounters, and checkout tasks.", "/patients", "Workflow"),
            _training_item("assistant_policy", "Assistant policy", "Review confirmation-gated assistant actions and safe-use expectations.", "/assistant-review", "AI safety"),
            _training_item("clinical_closeout", "Clinical closeout", "Review signed encounters, follow-up tasks, and patient handoff expectations.", "/reports", "Operations"),
        ]),
        _training_role("billing", "Billing", "Charge capture, eligibility, claim readiness, denial rework, payment, and audit expectations.", [
            _training_item("billing_workflow", "Billing workflow", "Review charge review, claim readiness, eligibility history, denial rework, and payment recording.", "/billing", "Workflow"),
            _training_item("payer_data_phi", "Payer data and PHI", "Review payer data handling, minimum necessary access, and billing audit expectations.", "/roles", "Compliance"),
            _training_item("clearinghouse_incidents", "Clearinghouse incidents", "Review failed integration events, retries, and vendor escalation.", "/integrations", "Operations"),
        ]),
        _training_role("manager", "Manager", "Launch evidence, access review, audit export, readiness, incidents, and go-live sign-off.", [
            _training_item("launch_evidence", "Launch evidence", "Review go-live packet, operator health, config audit, QA evidence, and dry-run sessions.", "/operations", "Launch"),
            _training_item("access_review", "Access review", "Review staff roles, MFA gaps, stale access reviews, and offboarding expectations.", "/staff", "Compliance"),
            _training_item("incident_backup", "Incident and backup response", "Review incident-response steps, backup/restore validation, and audit export ownership.", "/operations", "Operations"),
        ]),
    ]
    return {
        "generated_at": datetime.now(UTC),
        "roles": roles,
        "total_roles": len(roles),
        "total_items": sum(len(role["items"]) for role in roles),
    }


async def start_staff_training_session(db: AsyncSession, user: User, data: dict) -> dict:
    checklist = staff_training_checklist()
    session_id = str(uuid4())
    payload = _recalculate_staff_training_totals({
        "session_id": session_id,
        "session_name": data.get("session_name") or "Staff training",
        "trainer_name": data.get("trainer_name"),
        "status": "in_progress",
        "note": data.get("note"),
        "started_by": user.display_name,
        "completed_by": None,
        "started_at": datetime.now(UTC).isoformat(),
        "completed_at": None,
        "roles": [
            {
                **role,
                "items": [
                    {
                        **item,
                        "training_status": "pending",
                        "note": None,
                    }
                    for item in role["items"]
                ],
            }
            for role in checklist["roles"]
        ],
    })
    event = await log_event(
        db,
        STAFF_TRAINING_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _staff_training_session_from_audit(event)


async def list_staff_training_sessions(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == STAFF_TRAINING_SESSION_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(200))
    sessions: dict[str, dict] = {}
    for event in result.scalars().all():
        session = _staff_training_session_from_audit(event)
        sessions.setdefault(session["session_id"], session)
    return list(sessions.values())[:25], len(sessions)


async def update_staff_training_session(db: AsyncSession, user: User, session_id: str, data: dict) -> dict | None:
    latest = await _latest_staff_training_session_event(db, user, session_id)
    if not latest:
        return None

    payload = deepcopy(latest.payload or {})
    if data.get("note") is not None:
        payload["note"] = data["note"]
    if data.get("session_status"):
        payload["status"] = data["session_status"]
        if data["session_status"] == "completed" and not payload.get("completed_at"):
            payload["completed_at"] = datetime.now(UTC).isoformat()
            payload["completed_by"] = user.display_name

    role_key = data.get("role_key")
    item_key = data.get("item_key")
    if role_key or item_key:
        updated = False
        for role in payload.get("roles", []):
            if role.get("key") != role_key:
                continue
            for item in role.get("items", []):
                if item.get("key") != item_key:
                    continue
                if data.get("training_status"):
                    item["training_status"] = data["training_status"]
                if data.get("item_note") is not None:
                    item["note"] = data["item_note"]
                updated = True
                break
            break
        if not updated:
            return None

    payload = _recalculate_staff_training_totals(payload)
    event = await log_event(
        db,
        STAFF_TRAINING_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _staff_training_session_from_audit(event)


def policy_approval_checklist() -> dict:
    items = [
        _policy_item(
            "phi_retention",
            "PHI retention",
            "Review patient record, audit log, document, backup, and demo-data retention expectations.",
            "/operations",
            "Compliance",
            ["docs/compliance/phi-retention-and-incident-response.md"],
        ),
        _policy_item(
            "incident_response",
            "Incident response",
            "Review breach triage, account/credential containment, evidence preservation, notification, and corrective-action ownership.",
            "/operations",
            "Security",
            ["docs/compliance/phi-retention-and-incident-response.md"],
        ),
        _policy_item(
            "access_review",
            "Access review",
            "Review monthly access review, offboarding, privileged-account MFA, and audit export responsibilities.",
            "/staff",
            "Security",
            ["docs/compliance/phi-retention-and-incident-response.md", "docs/operations/production-launch-checklist.md"],
        ),
        _policy_item(
            "backup_restore",
            "Backup and restore",
            "Review backup validation, restore drills, retention location, access controls, RTO, and RPO approval.",
            "/operations",
            "Resilience",
            ["docs/operations/production-launch-checklist.md", "docs/operations/deployment-runbook.md"],
        ),
        _policy_item(
            "patient_outreach",
            "Patient outreach consent",
            "Review consent-gated SMS/email/portal outreach, blocked states, retries, and delivery callback responsibilities.",
            "/tasks",
            "Communications",
            ["docs/operations/daily-use-readiness.md", "docs/operations/production-launch-checklist.md"],
        ),
        _policy_item(
            "assistant_policy",
            "Assistant policy",
            "Review confirmation-gated assistant actions, tool authorization, audit visibility, and clinical responsibility boundaries.",
            "/assistant-review",
            "AI safety",
            ["docs/operations/daily-use-readiness.md", "docs/integrations/vendor-adapter-plan.md"],
        ),
    ]
    return {
        "generated_at": datetime.now(UTC),
        "items": items,
        "total": len(items),
    }


def restore_drill_checklist() -> dict:
    items = [
        _restore_drill_item(
            "backup_created",
            "Backup created",
            "Run a current backup and identify the backup folder used for the drill.",
            ["docs/operations/production-launch-checklist.md", "docs/operations/deployment-runbook.md"],
        ),
        _restore_drill_item(
            "backup_validated",
            "Backup validated",
            "Validate manifest, postgres dump, and object archive structure before restoring.",
            ["scripts/validate-backup.sh", "docs/operations/production-launch-checklist.md"],
        ),
        _restore_drill_item(
            "disposable_restore",
            "Disposable restore",
            "Restore into a disposable stack or environment without touching active clinic data.",
            ["scripts/restore-local.sh", "docs/compliance/phi-retention-and-incident-response.md"],
        ),
        _restore_drill_item(
            "application_smoke",
            "Application smoke",
            "Confirm login, patient search, document visibility, tasks, and reports after restore.",
            ["docs/operations/daily-use-readiness.md"],
        ),
        _restore_drill_item(
            "object_file_check",
            "Object file check",
            "Confirm restored object files are present and document handoff paths are usable.",
            ["docs/operations/production-launch-checklist.md"],
        ),
        _restore_drill_item(
            "rto_rpo_recorded",
            "RTO/RPO recorded",
            "Capture restore duration, backup age, RTO/RPO result, failures, and follow-up owner.",
            ["docs/compliance/phi-retention-and-incident-response.md"],
        ),
    ]
    return {"generated_at": datetime.now(UTC), "items": items, "total": len(items)}


async def start_restore_drill_session(db: AsyncSession, user: User, data: dict) -> dict:
    checklist = restore_drill_checklist()
    session_id = str(uuid4())
    payload = _recalculate_restore_drill_totals({
        "session_id": session_id,
        "session_name": data.get("session_name") or "Restore drill",
        "owner_name": data.get("owner_name"),
        "backup_reference": data.get("backup_reference"),
        "status": "in_progress",
        "note": data.get("note"),
        "started_by": user.display_name,
        "started_at": datetime.now(UTC).isoformat(),
        "completed_by": None,
        "completed_at": None,
        "rto_minutes": None,
        "rpo_minutes": None,
        "items": [
            {**item, "drill_status": "pending", "note": None}
            for item in checklist["items"]
        ],
    })
    event = await log_event(
        db,
        RESTORE_DRILL_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _restore_drill_session_from_audit(event)


async def list_restore_drill_sessions(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    rows = (
        await db.execute(
            select(AuditLog).where(
                AuditLog.organization_id == user.organization_id,
                AuditLog.event_type == RESTORE_DRILL_SESSION_EVENT_TYPE,
                AuditLog.entity_type == "operations",
            ).order_by(AuditLog.created_at.desc())
        )
    ).scalars().all()
    latest_by_session: dict[str, dict] = {}
    for event in rows:
        session = _restore_drill_session_from_audit(event)
        latest_by_session.setdefault(session["session_id"], session)
    sessions = list(latest_by_session.values())
    return sessions, len(sessions)


async def get_restore_drill_session(db: AsyncSession, user: User, session_id: str) -> dict | None:
    latest = await _latest_restore_drill_session_event(db, user, session_id)
    return _restore_drill_session_from_audit(latest) if latest else None


async def update_restore_drill_session(db: AsyncSession, user: User, session_id: str, data: dict) -> dict | None:
    latest = await _latest_restore_drill_session_event(db, user, session_id)
    if not latest:
        return None
    payload = deepcopy(latest.payload or {})
    item_key = data.get("item_key")
    if item_key:
        for item in payload.get("items", []):
            if item.get("key") == item_key:
                if data.get("drill_status"):
                    item["drill_status"] = data["drill_status"]
                if "item_note" in data:
                    item["note"] = data.get("item_note")
                break
    if "rto_minutes" in data:
        payload["rto_minutes"] = data.get("rto_minutes")
    if "rpo_minutes" in data:
        payload["rpo_minutes"] = data.get("rpo_minutes")
    if data.get("note") is not None:
        payload["note"] = data.get("note")
    if data.get("session_status"):
        payload["status"] = data["session_status"]
        if data["session_status"] == "completed":
            payload["completed_by"] = user.display_name
            payload["completed_at"] = datetime.now(UTC).isoformat()
    payload = _recalculate_restore_drill_totals(payload)
    event = await log_event(
        db,
        RESTORE_DRILL_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _restore_drill_session_from_audit(event)


async def start_policy_approval_session(db: AsyncSession, user: User, data: dict) -> dict:
    checklist = policy_approval_checklist()
    session_id = str(uuid4())
    payload = _recalculate_policy_approval_totals({
        "session_id": session_id,
        "session_name": data.get("session_name") or "Policy approval",
        "reviewer_name": data.get("reviewer_name"),
        "status": "in_progress",
        "note": data.get("note"),
        "started_by": user.display_name,
        "completed_by": None,
        "started_at": datetime.now(UTC).isoformat(),
        "completed_at": None,
        "items": [
            {
                **item,
                "approval_status": "pending",
                "note": None,
            }
            for item in checklist["items"]
        ],
    })
    event = await log_event(
        db,
        POLICY_APPROVAL_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _policy_approval_session_from_audit(event)


async def list_policy_approval_sessions(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == POLICY_APPROVAL_SESSION_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(200))
    sessions: dict[str, dict] = {}
    for event in result.scalars().all():
        session = _policy_approval_session_from_audit(event)
        sessions.setdefault(session["session_id"], session)
    return list(sessions.values())[:25], len(sessions)


async def update_policy_approval_session(db: AsyncSession, user: User, session_id: str, data: dict) -> dict | None:
    latest = await _latest_policy_approval_session_event(db, user, session_id)
    if not latest:
        return None

    payload = deepcopy(latest.payload or {})
    if data.get("note") is not None:
        payload["note"] = data["note"]
    if data.get("session_status"):
        payload["status"] = data["session_status"]
        if data["session_status"] == "completed" and not payload.get("completed_at"):
            payload["completed_at"] = datetime.now(UTC).isoformat()
            payload["completed_by"] = user.display_name

    item_key = data.get("item_key")
    if item_key:
        updated = False
        for item in payload.get("items", []):
            if item.get("key") != item_key:
                continue
            if data.get("approval_status"):
                item["approval_status"] = data["approval_status"]
            if data.get("item_note") is not None:
                item["note"] = data["item_note"]
            updated = True
            break
        if not updated:
            return None

    payload = _recalculate_policy_approval_totals(payload)
    event = await log_event(
        db,
        POLICY_APPROVAL_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _policy_approval_session_from_audit(event)


def cutover_runbook() -> dict:
    phases = [
        _cutover_phase("pre_cutover", "Pre-cutover", "Confirm launch inputs and freeze risky changes before the cutover window.", [
            _cutover_step("confirm_owner", "Confirm cutover owner", "Confirm cutover owner, vendor contacts, escalation channel, and decision authority.", "manager", -60, None),
            _cutover_step("final_backup", "Run final backup", "Run backup and confirm restore marker or documented rollback snapshot.", "operations", -45, "Backup fails or restore marker is missing."),
            _cutover_step("freeze_changes", "Freeze noncritical changes", "Pause noncritical workflow changes and confirm staff are using the rehearsal plan.", "manager", -30, "Unexpected configuration drift is detected."),
        ]),
        _cutover_phase("cutover_window", "Cutover window", "Switch production-facing configuration and verify critical access paths.", [
            _cutover_step("deploy_release", "Deploy release", "Deploy the approved release and confirm health checks.", "operations", 0, "Health check fails after deploy."),
            _cutover_step("verify_identity", "Verify identity access", "Confirm admin/manager/provider/front desk access and session policy.", "manager", 10, "Privileged user cannot authenticate."),
            _cutover_step("enable_integrations", "Enable integrations", "Enable approved vendor credentials and confirm credential preflight.", "operations", 20, "Credential preflight has blocking items."),
        ]),
        _cutover_phase("validation", "Validation", "Validate clinical, front-office, billing, and audit workflows before staff use.", [
            _cutover_step("patient_chart_smoke", "Validate patient chart", "Open patient search, chart, documents, meds, care plan, and checkout handoff.", "ma_nurse", 30, "Patient chart or document workflow fails."),
            _cutover_step("front_office_smoke", "Validate front office", "Validate scheduling, portal intake, messaging, faxes, and reports.", "front_desk", 40, "Scheduling, intake, or fax workflow fails."),
            _cutover_step("billing_smoke", "Validate billing", "Validate charge review, claim readiness, eligibility, and audit trail visibility.", "billing", 50, "Billing or eligibility workflow fails."),
        ]),
        _cutover_phase("rollback", "Rollback decision", "Make an explicit go/no-go decision and document rollback readiness.", [
            _cutover_step("rollback_tree", "Review rollback decision tree", "Review blockers, owner authority, communication path, and rollback trigger thresholds.", "manager", 55, "Any critical validation gate remains unresolved."),
            _cutover_step("go_no_go", "Record go/no-go", "Record go/no-go decision, final owner, and follow-up monitoring plan.", "manager", 60, "Go/no-go owner does not approve launch."),
        ]),
    ]
    return {
        "generated_at": datetime.now(UTC),
        "phases": phases,
        "total_phases": len(phases),
        "total_steps": sum(len(phase["steps"]) for phase in phases),
    }


async def start_cutover_runbook_session(db: AsyncSession, user: User, data: dict) -> dict:
    runbook = cutover_runbook()
    session_id = str(uuid4())
    scheduled_for = data.get("scheduled_for")
    if hasattr(scheduled_for, "isoformat"):
        scheduled_for = scheduled_for.isoformat()
    payload = _recalculate_cutover_totals({
        "session_id": session_id,
        "session_name": data.get("session_name") or "Production cutover rehearsal",
        "cutover_owner": data.get("cutover_owner"),
        "scheduled_for": scheduled_for,
        "status": "in_progress",
        "rollback_status": "not_reviewed",
        "rollback_decision": None,
        "note": data.get("note"),
        "started_by": user.display_name,
        "completed_by": None,
        "started_at": datetime.now(UTC).isoformat(),
        "completed_at": None,
        "phases": [
            {
                **phase,
                "steps": [
                    {
                        **step,
                        "step_status": "pending",
                        "owner_name": None,
                        "note": None,
                    }
                    for step in phase["steps"]
                ],
            }
            for phase in runbook["phases"]
        ],
    })
    event = await log_event(
        db,
        CUTOVER_RUNBOOK_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _cutover_runbook_session_from_audit(event)


async def list_cutover_runbook_sessions(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == CUTOVER_RUNBOOK_SESSION_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(200))
    sessions: dict[str, dict] = {}
    for event in result.scalars().all():
        session = _cutover_runbook_session_from_audit(event)
        sessions.setdefault(session["session_id"], session)
    return list(sessions.values())[:25], len(sessions)


async def get_cutover_runbook_session(db: AsyncSession, user: User, session_id: str) -> dict | None:
    latest = await _latest_cutover_runbook_session_event(db, user, session_id)
    return _cutover_runbook_session_from_audit(latest) if latest else None


async def update_cutover_runbook_session(db: AsyncSession, user: User, session_id: str, data: dict) -> dict | None:
    latest = await _latest_cutover_runbook_session_event(db, user, session_id)
    if not latest:
        return None

    payload = deepcopy(latest.payload or {})
    if data.get("note") is not None:
        payload["note"] = data["note"]
    if data.get("rollback_status"):
        payload["rollback_status"] = data["rollback_status"]
    if data.get("rollback_decision") is not None:
        payload["rollback_decision"] = data["rollback_decision"]
    if data.get("session_status"):
        payload["status"] = data["session_status"]
        if data["session_status"] in {"completed", "aborted"} and not payload.get("completed_at"):
            payload["completed_at"] = datetime.now(UTC).isoformat()
            payload["completed_by"] = user.display_name

    phase_key = data.get("phase_key")
    step_key = data.get("step_key")
    if phase_key or step_key:
        updated = False
        for phase in payload.get("phases", []):
            if phase.get("key") != phase_key:
                continue
            for step in phase.get("steps", []):
                if step.get("key") != step_key:
                    continue
                if data.get("step_status"):
                    step["step_status"] = data["step_status"]
                if data.get("owner_name") is not None:
                    step["owner_name"] = data["owner_name"]
                if data.get("step_note") is not None:
                    step["note"] = data["step_note"]
                updated = True
                break
            break
        if not updated:
            return None

    payload = _recalculate_cutover_totals(payload)
    event = await log_event(
        db,
        CUTOVER_RUNBOOK_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _cutover_runbook_session_from_audit(event)


async def create_readiness_snapshot(db: AsyncSession, user: User) -> dict:
    readiness = await check_readiness()
    launch = await launch_readiness()
    incidents = await incident_register(db, user)
    payload = {
        "operational_status": readiness["operational_status"],
        "core_status": readiness["status"],
        "launch_score": launch["score"],
        "incident_count": incidents["open_count"],
        "critical_count": incidents["critical_count"],
        "warning_count": incidents["warning_count"],
    }
    event = await log_event(
        db,
        SNAPSHOT_EVENT_TYPE,
        "operations",
        user.organization_id,
        actor_id=user.id,
        payload=payload,
    )
    return _snapshot_from_audit(event)


async def list_readiness_snapshots(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == SNAPSHOT_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(25))
    return [_snapshot_from_audit(item) for item in result.scalars().all()], total


async def production_rehearsal_report(db: AsyncSession, user: User) -> dict:
    readiness = await check_readiness()
    launch = await launch_readiness()
    incidents = await incident_register(db, user)
    preflight = await integration_config_service.credential_preflight(db, user)
    access_review = await user_service.access_review_summary(db, user)
    closeout = await _rehearsal_closeout_status(db, user)
    deployment = readiness.get("deployment", {})
    gates = [
        _gate(
            "core_readiness",
            "Core readiness",
            "ready" if readiness.get("status") == "ok" else "blocking",
            100 if readiness.get("status") == "ok" else 0,
            f"Core status is {readiness.get('status', 'unknown')}.",
            "/operations",
        ),
        _gate(
            "daily_closeout",
            "Daily closeout",
            "ready" if closeout["status"] == "clear" else "blocking",
            closeout["score"],
            closeout["detail"],
            "/reports",
        ),
        _gate(
            "incident_register",
            "Incident register",
            "ready" if incidents["critical_count"] == 0 else "blocking",
            max(0, 100 - incidents["critical_count"] * 25 - incidents["warning_count"] * 10),
            f"{incidents['critical_count']} critical and {incidents['warning_count']} warning incident(s) are open.",
            "/operations",
        ),
        _gate(
            "launch_readiness",
            "Launch readiness",
            "ready" if launch["critical_blockers"] == 0 else "blocking",
            launch["score"],
            f"{launch['critical_blockers']} critical launch blocker(s), {launch['warnings']} warning(s).",
            "/setup",
        ),
        _gate(
            "credential_preflight",
            "Credential preflight",
            "ready" if preflight["blocking_count"] == 0 else "blocking",
            round((preflight["ready_count"] / preflight["total"]) * 100) if preflight["total"] else 0,
            f"{preflight['blocking_count']} missing or blocked integration item(s), {preflight['staged_count']} staged.",
            "/integrations",
        ),
        _gate(
            "access_review",
            "Access review",
            "ready" if access_review["due_count"] == 0 and access_review["privileged_without_mfa_count"] == 0 else "blocking",
            max(0, 100 - access_review["due_count"] * 15 - access_review["privileged_without_mfa_count"] * 20),
            f"{access_review['due_count']} access review item(s) due; {access_review['privileged_without_mfa_count']} privileged account(s) without MFA.",
            "/staff",
        ),
        _gate(
            "backup_restore",
            "Backup and restore",
            "ready"
            if deployment.get("latest_backup", {}).get("ok") and deployment.get("latest_restore", {}).get("ok")
            else "warning",
            100
            if deployment.get("latest_backup", {}).get("ok") and deployment.get("latest_restore", {}).get("ok")
            else 50
            if deployment.get("latest_backup", {}).get("ok")
            else 0,
            _backup_restore_detail(deployment),
            "/operations",
        ),
    ]
    blocking = sum(1 for gate in gates if gate["status"] == "blocking")
    warnings = sum(1 for gate in gates if gate["status"] == "warning")
    score = round(sum(gate["score"] for gate in gates) / len(gates)) if gates else 0
    recommended_actions = [
        {
            "key": gate["key"],
            "label": f"Resolve {gate['label']}",
            "detail": gate["detail"],
            "route": gate["route"],
            "severity": gate["status"],
        }
        for gate in gates
        if gate["status"] != "ready"
    ]
    assignments = await _rehearsal_assignments_by_key(db, user)
    for action in recommended_actions:
        action["assignment"] = assignments.get(action["key"])

    return {
        "status": "ready" if blocking == 0 else "attention",
        "rehearsal_ready": blocking == 0,
        "score": score,
        "blocking_count": blocking,
        "warning_count": warnings,
        "generated_at": datetime.now(UTC),
        "gates": gates,
        "recommended_actions": recommended_actions,
    }


async def assign_rehearsal_action(db: AsyncSession, user: User, action_key: str, data: dict) -> dict | None:
    report = await production_rehearsal_report(db, user)
    action = next((item for item in report["recommended_actions"] if item["key"] == action_key), None)
    if not action:
        return None
    payload = {
        "action_key": action_key,
        "label": action["label"],
        "severity": action["severity"],
        "route": action["route"],
        "owner_id": data.get("owner_id"),
        "owner_name": data["owner_name"],
        "status": data.get("status") or "open",
        "due_date": data.get("due_date"),
        "note": data.get("note"),
        "assigned_by": user.display_name,
    }
    event = await log_event(
        db,
        REHEARSAL_ASSIGNMENT_EVENT_TYPE,
        "operations",
        action_key,
        actor_id=user.id,
        payload=payload,
    )
    return _rehearsal_assignment_from_audit(event)


async def launch_workplan(db: AsyncSession, user: User) -> dict:
    rehearsal = await production_rehearsal_report(db, user)
    incidents = await incident_register(db, user)
    launch = await launch_readiness()
    preflight = await integration_config_service.credential_preflight(db, user)
    items: list[dict] = []
    credential_assignment = next(
        (
            action.get("assignment")
            for action in rehearsal["recommended_actions"]
            if action["key"] == "credential_preflight"
        ),
        None,
    )

    for action in rehearsal["recommended_actions"]:
        items.append(_workplan_item(
            key=f"rehearsal_{action['key']}",
            source="rehearsal",
            category="Production rehearsal",
            label=action["label"],
            detail=action["detail"],
            severity=action["severity"],
            route=action["route"],
            owner_role="operations",
            recommended_action="Assign an owner, clear the blocker, and save rehearsal evidence.",
            assignment=action.get("assignment"),
        ))

    for incident in incidents["data"]:
        items.append(_workplan_item(
            key=f"incident_{incident['key']}",
            source="incident",
            category=incident["source"],
            label=incident["title"],
            detail=incident["detail"],
            severity="blocking" if incident["severity"] == "critical" else "warning",
            route=incident["route"],
            owner_role=incident["owner_role"],
            recommended_action=incident["recommended_action"],
        ))

    for requirement in launch.get("requirements", []):
        if requirement.get("ready"):
            continue
        items.append(_workplan_item(
            key=f"launch_{requirement['key']}",
            source="launch_requirement",
            category=requirement["category"],
            label=requirement["label"],
            detail=requirement["detail"],
            severity="blocking" if requirement["severity"] == "critical" else "warning",
            route="/setup",
            owner_role="operations",
            recommended_action=requirement["action"],
        ))

    for integration in preflight.get("data", []):
        if integration["status"] == "ready":
            continue
        blockers = integration.get("blockers") or []
        missing_steps = [
            step["label"]
            for step in integration.get("steps", [])
            if step["status"] != "ready"
        ]
        detail = "; ".join(blockers or missing_steps or [f"{integration['label']} needs credential preflight review."])
        items.append(_workplan_item(
            key=f"credential_{integration['key']}",
            source="credential_preflight",
            category="Integrations",
            label=f"{integration['label']} preflight",
            detail=detail,
            severity="blocking" if integration["status"] == "blocked" else "warning",
            route="/integrations",
            owner_role="operations",
            recommended_action="Complete missing credential fields, connection test, and sandbox evidence.",
            assignment=credential_assignment,
        ))

    items.extend(await _vendor_handoff_archive_workplan_items(db, user, preflight, credential_assignment))

    deduped = _dedupe_workplan_items(items)
    blocking = sum(1 for item in deduped if item["severity"] == "blocking")
    warnings = sum(1 for item in deduped if item["severity"] == "warning")
    assigned = sum(1 for item in deduped if item.get("assignment"))
    unassigned_blocking = sum(
        1 for item in deduped
        if item["severity"] == "blocking" and not item.get("assignment")
    )
    return {
        "status": "clear" if not deduped else "attention",
        "generated_at": datetime.now(UTC),
        "total": len(deduped),
        "blocking_count": blocking,
        "warning_count": warnings,
        "assigned_count": assigned,
        "unassigned_count": len(deduped) - assigned,
        "unassigned_blocking_count": unassigned_blocking,
        "items": deduped,
    }


async def credential_dry_run_binder(db: AsyncSession, user: User) -> dict:
    preflight = await integration_config_service.credential_preflight(db, user)
    archives = await _latest_vendor_handoff_archives(db, user)
    items = [_credential_binder_item(item, archives.get(item["key"])) for item in preflight.get("data", [])]
    blocking_count = sum(1 for item in items if item["binder_status"] == "blocking")
    warning_count = sum(1 for item in items if item["binder_status"] == "warning")
    ready_count = sum(1 for item in items if item["binder_status"] == "ready")
    archive_ready_count = sum(1 for item in items if item["handoff_archive"]["status"] == "ready")
    vendor_reference_ready_count = sum(
        1
        for item in items
        if item["sandbox_reference_total"] > 0 and item["sandbox_reference_count"] == item["sandbox_reference_total"]
    )
    return {
        "status": "ready" if blocking_count == 0 and warning_count == 0 else "blocked" if blocking_count else "attention",
        "generated_at": datetime.now(UTC),
        "export_filename": "concierge-os-credential-dry-run-binder.csv",
        "ready_count": ready_count,
        "warning_count": warning_count,
        "blocking_count": blocking_count,
        "archive_ready_count": archive_ready_count,
        "vendor_reference_ready_count": vendor_reference_ready_count,
        "total": len(items),
        "summary": {
            "total": len(items),
            "ready": ready_count,
            "warning": warning_count,
            "blocking": blocking_count,
            "archive_ready": archive_ready_count,
            "vendor_reference_ready": vendor_reference_ready_count,
            "credential_blockers": preflight.get("blocking_count", 0),
            "credential_staged": preflight.get("staged_count", 0),
        },
        "items": items,
    }


async def _vendor_handoff_archive_workplan_items(
    db: AsyncSession | None,
    user: User,
    preflight: dict,
    assignment: dict | None = None,
) -> list[dict]:
    required = [
        item
        for item in preflight.get("data", [])
        if item.get("readiness_mode") == "production_vendor"
        and item.get("production_ready")
        and item.get("status") == "ready"
    ]
    if not required:
        return []

    archives = await _latest_vendor_handoff_archives(db, user)
    items: list[dict] = []
    for integration in required:
        archive = archives.get(integration["key"])
        if archive and archive.get("archive_reference_url"):
            continue
        has_archive = bool(archive)
        items.append(_workplan_item(
            key=f"handoff_archive_{integration['key']}",
            source="vendor_handoff_archive",
            category="Integrations",
            label=f"{integration['label']} handoff archive",
            detail=(
                f"{integration['label']} handoff packet is archived but needs a launch evidence reference."
                if has_archive
                else f"{integration['label']} is production-vendor ready, but its vendor handoff packet has not been archived for launch review."
            ),
            severity="warning" if has_archive else "blocking",
            route="/integrations",
            owner_role="operations",
            recommended_action="Export and archive the vendor handoff packet with a launch evidence reference before live-use rehearsal.",
            assignment=assignment,
        ))
    return items


async def go_live_packet(db: AsyncSession, user: User) -> dict:
    readiness = await check_readiness()
    launch = await launch_readiness()
    preflight = await integration_config_service.credential_preflight(db, user)
    workplan = await launch_workplan(db, user)
    readiness_snapshots, _ = await list_readiness_snapshots(db, user)
    rehearsal_snapshots, _ = await list_rehearsal_snapshots(db, user)
    workplan_snapshots, _ = await list_launch_workplan_snapshots(db, user)
    attestations, _ = await list_go_live_attestations(db, user)
    dry_run_sessions, _ = await list_role_dry_run_sessions(db, user)
    browser_qa_sessions, _ = await list_browser_qa_sessions(db, user)
    staff_training_sessions, _ = await list_staff_training_sessions(db, user)
    policy_approval_sessions, _ = await list_policy_approval_sessions(db, user)
    restore_drill_sessions, _ = await list_restore_drill_sessions(db, user)
    cutover_sessions, _ = await list_cutover_runbook_sessions(db, user)
    deployment = readiness.get("deployment", {})
    handoff_archive_evidence = await _vendor_handoff_archive_packet_evidence(db, user, preflight)

    latest_readiness = readiness_snapshots[0] if readiness_snapshots else None
    latest_rehearsal = rehearsal_snapshots[0] if rehearsal_snapshots else None
    latest_workplan = workplan_snapshots[0] if workplan_snapshots else None
    latest_dry_run = dry_run_sessions[0] if dry_run_sessions else None
    latest_browser_qa = browser_qa_sessions[0] if browser_qa_sessions else None
    latest_training = staff_training_sessions[0] if staff_training_sessions else None
    latest_policy_approval = policy_approval_sessions[0] if policy_approval_sessions else None
    latest_restore_drill = restore_drill_sessions[0] if restore_drill_sessions else None
    latest_cutover = cutover_sessions[0] if cutover_sessions else None
    backup_ok = bool(deployment.get("latest_backup", {}).get("ok"))
    restore_ok = bool(deployment.get("latest_restore", {}).get("ok"))

    workplan_unassigned_blocking = latest_workplan["unassigned_blocking_count"] if latest_workplan else 0
    workplan_snapshot_status = (
        "blocking"
        if workplan_unassigned_blocking
        else "ready"
        if latest_workplan
        else "missing"
    )
    workplan_snapshot_detail = (
        f"{latest_workplan['blocking_count']} blocking and {latest_workplan['unassigned_count']} unassigned item(s) captured; "
        f"{workplan_unassigned_blocking} unassigned blocking item(s) require ownership."
        if latest_workplan and workplan_unassigned_blocking
        else f"{latest_workplan['blocking_count']} blocking and {latest_workplan['unassigned_count']} unassigned item(s) captured."
        if latest_workplan
        else "Save the Launch Workplan before the rehearsal."
    )
    cutover_status = (
        "blocking"
        if latest_cutover and (
            latest_cutover["blocked_count"] > 0
            or latest_cutover["rollback_count"] > 0
            or latest_cutover["rollback_status"] == "rollback_required"
        )
        else "ready"
        if latest_cutover
        and latest_cutover["status"] == "completed"
        and latest_cutover["pending_count"] == 0
        and latest_cutover["rollback_status"] in {"rollback_ready", "not_needed"}
        and bool(latest_cutover.get("rollback_decision"))
        else "warning"
        if latest_cutover
        else "missing"
    )
    cutover_detail = (
        f"{latest_cutover['complete_count']} complete, {latest_cutover['blocked_count']} blocked, "
        f"{latest_cutover['rollback_count']} rollback, {latest_cutover['pending_count']} pending step(s); "
        f"rollback status {latest_cutover['rollback_status']}."
        if latest_cutover
        else "Start and complete a cutover runbook session with rollback decision evidence."
    )
    readiness_snapshot_status = _readiness_snapshot_packet_status(latest_readiness)
    readiness_snapshot_detail = (
        _readiness_snapshot_packet_detail(latest_readiness)
        if latest_readiness
        else "Save a readiness snapshot from Operations."
    )

    evidence = [
        _packet_evidence(
            "readiness_snapshot",
            "Readiness snapshot",
            readiness_snapshot_status,
            readiness_snapshot_detail,
            "/operations",
            latest_readiness["created_at"] if latest_readiness else None,
        ),
        _packet_evidence(
            "launch_workplan_snapshot",
            "Launch workplan snapshot",
            workplan_snapshot_status,
            workplan_snapshot_detail,
            "/operations",
            latest_workplan["created_at"] if latest_workplan else None,
        ),
        _packet_evidence(
            "production_rehearsal_snapshot",
            "Production rehearsal snapshot",
            "ready"
            if latest_rehearsal and latest_rehearsal["rehearsal_ready"]
            else "blocking"
            if latest_rehearsal and latest_rehearsal["blocking_count"] > 0
            else "warning"
            if latest_rehearsal
            else "missing",
            f"{latest_rehearsal['blocking_count']} blocker(s), {latest_rehearsal['warning_count']} warning(s) captured."
            if latest_rehearsal
            else "Save the production rehearsal report.",
            "/operations",
            latest_rehearsal["created_at"] if latest_rehearsal else None,
        ),
        _packet_evidence(
            "role_dry_run_session",
            "Role dry-run session",
            "ready"
            if latest_dry_run and latest_dry_run["status"] == "completed" and latest_dry_run["pending_count"] == 0 and latest_dry_run["blocked_count"] == 0
            else "blocking"
            if latest_dry_run and latest_dry_run["blocked_count"] > 0
            else "warning"
            if latest_dry_run
            else "missing",
            f"{latest_dry_run['complete_count']} complete, {latest_dry_run['blocked_count']} blocked, {latest_dry_run['pending_count']} pending item(s)."
            if latest_dry_run
            else "Start and complete a role dry-run session with staff evidence notes.",
            "/operations",
            latest_dry_run["updated_at"] if latest_dry_run else None,
        ),
        _packet_evidence(
            "browser_qa_session",
            "Browser QA session",
            "ready"
            if latest_browser_qa and latest_browser_qa["status"] == "completed" and latest_browser_qa["pending_count"] == 0 and latest_browser_qa["failed_count"] == 0
            else "blocking"
            if latest_browser_qa and latest_browser_qa["failed_count"] > 0
            else "warning"
            if latest_browser_qa
            else "missing",
            f"{latest_browser_qa['passed_count']} passed, {latest_browser_qa['failed_count']} failed, {latest_browser_qa['pending_count']} pending item(s)."
            if latest_browser_qa
            else "Complete a browser QA session for major staff workflows.",
            "/operations",
            latest_browser_qa["updated_at"] if latest_browser_qa else None,
        ),
        _packet_evidence(
            "staff_training_session",
            "Staff training session",
            "ready"
            if latest_training and latest_training["status"] == "completed" and latest_training["pending_count"] == 0
            else "warning"
            if latest_training
            else "missing",
            f"{latest_training['signed_count']} signed, {latest_training['reviewed_count']} reviewed, {latest_training['pending_count']} pending item(s)."
            if latest_training
            else "Complete staff training sign-off for all clinic roles.",
            "/operations",
            latest_training["updated_at"] if latest_training else None,
        ),
        _packet_evidence(
            "policy_approval_session",
            "Policy approval session",
            "ready"
            if latest_policy_approval and latest_policy_approval["status"] == "completed" and latest_policy_approval["pending_count"] == 0 and latest_policy_approval["needs_changes_count"] == 0
            else "warning"
            if latest_policy_approval
            else "missing",
            f"{latest_policy_approval['approved_count']} approved, {latest_policy_approval['needs_changes_count']} needs changes, {latest_policy_approval['pending_count']} pending item(s)."
            if latest_policy_approval
            else "Complete compliance policy approval before live-use rehearsal.",
            "/operations",
            latest_policy_approval["updated_at"] if latest_policy_approval else None,
        ),
        _packet_evidence(
            "credential_preflight",
            "Credential preflight",
            "ready" if preflight["blocking_count"] == 0 else "blocking",
            f"{preflight['blocking_count']} blocking integration item(s), {preflight['staged_count']} staged.",
            "/integrations",
            None,
        ),
        handoff_archive_evidence,
        _packet_evidence(
            "backup_restore",
            "Backup and restore",
            "ready" if backup_ok and restore_ok else "warning" if backup_ok else "blocking",
            _backup_restore_detail(deployment),
            "/operations",
            deployment.get("latest_restore", {}).get("last_success_at") or deployment.get("latest_backup", {}).get("last_success_at"),
        ),
        _packet_evidence(
            "restore_drill_session",
            "Restore drill session",
            "ready"
            if latest_restore_drill and latest_restore_drill["status"] == "completed" and latest_restore_drill["pending_count"] == 0 and latest_restore_drill["blocked_count"] == 0
            else "warning"
            if latest_restore_drill
            else "missing",
            f"{latest_restore_drill['complete_count']} complete, {latest_restore_drill['blocked_count']} blocked, {latest_restore_drill['pending_count']} pending item(s). RTO {latest_restore_drill['rto_minutes'] if latest_restore_drill['rto_minutes'] is not None else 'not recorded'} min, RPO {latest_restore_drill['rpo_minutes'] if latest_restore_drill['rpo_minutes'] is not None else 'not recorded'} min."
            if latest_restore_drill
            else "Start and complete a restore drill session with RTO/RPO evidence.",
            "/operations",
            latest_restore_drill["updated_at"] if latest_restore_drill else None,
        ),
        _packet_evidence(
            "cutover_runbook_session",
            "Cutover runbook session",
            cutover_status,
            cutover_detail,
            "/operations",
            latest_cutover["updated_at"] if latest_cutover else None,
        ),
    ]
    blocking = sum(1 for item in evidence if item["status"] == "blocking") + workplan["blocking_count"] + launch["critical_blockers"]
    warnings = sum(1 for item in evidence if item["status"] == "warning") + workplan["warning_count"] + launch["warnings"]
    ready_count = sum(1 for item in evidence if item["status"] == "ready")
    all_evidence_ready = ready_count == len(evidence)
    go_live_ready = blocking == 0 and warnings == 0 and all_evidence_ready and readiness["operational_status"] == "ok"
    return {
        "status": "ready" if go_live_ready else "attention",
        "go_live_ready": go_live_ready,
        "generated_at": datetime.now(UTC),
        "environment": readiness["environment"],
        "core_status": readiness["status"],
        "operational_status": readiness["operational_status"],
        "launch_score": launch["score"],
        "blocking_count": blocking,
        "warning_count": warnings,
        "evidence_ready_count": ready_count,
        "evidence_total": len(evidence),
        "evidence": evidence,
        "open_workplan_items": workplan["items"][:8],
        "latest_attestation": attestations[0] if attestations else None,
    }


async def live_use_rehearsal(db: AsyncSession, user: User) -> dict:
    packet = await go_live_packet(db, user)
    rehearsal = await production_rehearsal_report(db, user)
    workplan = await launch_workplan(db, user)
    preflight = await integration_config_service.credential_preflight(db, user)
    evidence_by_key = {item["key"]: item for item in packet["evidence"]}

    gates = [
        _live_gate(
            "go_live_packet",
            "Go-live packet",
            "ready" if packet["go_live_ready"] else "blocking" if packet["blocking_count"] else "warning",
            f"{packet['blocking_count']} blocker(s), {packet['warning_count']} warning(s), {packet['evidence_ready_count']} of {packet['evidence_total']} evidence item(s) ready.",
            "/operations",
            None,
        ),
        _live_gate(
            "production_rehearsal",
            "Production rehearsal",
            "ready" if rehearsal["rehearsal_ready"] else "blocking" if rehearsal["blocking_count"] else "warning",
            f"{rehearsal['blocking_count']} blocker(s), {rehearsal['warning_count']} warning(s).",
            "/operations",
            None,
        ),
        _live_gate(
            "launch_workplan",
            "Launch workplan",
            "ready" if workplan["total"] == 0 else "blocking" if workplan["blocking_count"] else "warning",
            f"{workplan['blocking_count']} blocking, {workplan['warning_count']} warning, {workplan['unassigned_count']} unassigned item(s).",
            "/operations",
            None,
        ),
        _live_gate(
            "credential_preflight",
            "Credential preflight",
            "ready" if preflight["blocking_count"] == 0 else "blocking",
            f"{preflight['blocking_count']} blocking integration item(s), {preflight['staged_count']} staged.",
            "/integrations",
            None,
        ),
        _live_gate_from_evidence("vendor_handoff_archives", "Vendor handoff archives", evidence_by_key.get("vendor_handoff_archives")),
        _live_gate_from_evidence("browser_qa", "Browser QA", evidence_by_key.get("browser_qa_session")),
        _live_gate_from_evidence("staff_training", "Staff training", evidence_by_key.get("staff_training_session")),
        _live_gate_from_evidence("policy_approval", "Policy approval", evidence_by_key.get("policy_approval_session")),
        _live_gate_from_evidence("role_dry_run", "Role dry-run", evidence_by_key.get("role_dry_run_session")),
    ]
    blocking_count = sum(1 for gate in gates if gate["status"] == "blocking")
    warning_count = sum(1 for gate in gates if gate["status"] in {"warning", "missing"})
    ready_count = sum(1 for gate in gates if gate["status"] == "ready")
    score = round((ready_count / len(gates)) * 100) if gates else 0
    next_actions = _live_use_next_actions(gates, workplan["items"], preflight.get("data", []))
    return {
        "status": "ready" if blocking_count == 0 and warning_count == 0 else "blocked" if blocking_count else "attention",
        "launch_ready": blocking_count == 0 and warning_count == 0 and packet["go_live_ready"],
        "score": score,
        "generated_at": datetime.now(UTC),
        "summary": {
            "ready_gates": ready_count,
            "blocking_gates": blocking_count,
            "warning_gates": warning_count,
            "evidence_ready_count": packet["evidence_ready_count"],
            "evidence_total": packet["evidence_total"],
            "workplan_blockers": workplan["blocking_count"],
            "workplan_warnings": workplan["warning_count"],
            "workplan_unassigned": workplan["unassigned_count"],
            "credential_blockers": preflight["blocking_count"],
            "credential_staged": preflight["staged_count"],
        },
        "gates": gates,
        "evidence": packet["evidence"],
        "next_actions": next_actions[:10],
        "open_workplan_items": workplan["items"][:10],
    }


async def role_dry_run_checklists(db: AsyncSession, user: User) -> dict:
    closeout = await _rehearsal_closeout_status(db, user)
    workplan = await launch_workplan(db, user)
    preflight = await integration_config_service.credential_preflight(db, user)
    roles = [
        _role_checklist(
            "front_desk",
            "Front desk",
            "Own arrivals, checkout handoff, scheduling, portal intake, and patient communication routing.",
            [
                _checklist_item("today_queue", "Review today's queue", "Confirm scheduled, checked-in, in-progress, and blocked patients from Command Center.", "/", "ready"),
                _checklist_item("checkout_handoff", "Complete checkout handoff", "Open a patient chart and complete checkout tasks before the patient leaves.", "/patients", "ready"),
                _checklist_item("schedule_followup", "Schedule follow-up", "Create or adjust a follow-up appointment after checkout.", "/scheduling", "ready"),
                _checklist_item("portal_intake", "Process portal intake", "Apply intake updates, convert document uploads, or reject invalid submissions.", "/portal-intake", "ready"),
            ],
        ),
        _role_checklist(
            "ma_nurse",
            "MA / nurse",
            "Reconcile clinical intake, outside documents, medication review, labs, and care-plan blockers.",
            [
                _checklist_item("outside_documents", "Review outside documents", "File, reconcile, or escalate outside records from the patient chart.", "/patients", "attention" if closeout["documents"] else "ready"),
                _checklist_item("med_reconciliation", "Reconcile medications", "Confirm review or held medication items during rooming/check-out.", "/patients", "ready"),
                _checklist_item("lab_review", "Review labs", "Confirm new or needs-review lab results and route blockers to provider.", "/patients", "ready"),
                _checklist_item("care_plan", "Work care plan", "Update nursing-owned care-plan items and escalate blocked items.", "/patients", "ready"),
            ],
        ),
        _role_checklist(
            "provider",
            "Provider",
            "Resolve clinical flags, documents, labs, medications, encounters, and provider-owned checkout work.",
            [
                _checklist_item("clinical_flags", "Review chart blockers", "Open a patient chart and resolve clinical flags before checkout.", "/patients", "ready"),
                _checklist_item("sign_encounter", "Sign encounter", "Complete draft or provider-review encounters for downstream billing.", "/patients", "attention" if closeout["unsigned"] else "ready"),
                _checklist_item("orders_tasks", "Create follow-up tasks", "Create clinical follow-up tasks for calls, orders, and outside records.", "/tasks", "ready"),
                _checklist_item("assistant_review", "Review assistant actions", "Confirm or reject staged assistant actions before they affect workflows.", "/assistant-review", "ready"),
            ],
        ),
        _role_checklist(
            "billing",
            "Billing",
            "Run charge capture, claim readiness, eligibility, denial rework, and remittance review.",
            [
                _checklist_item("charge_review", "Review charges", "Convert signed encounters into billing cases and clear coding gaps.", "/billing", "ready"),
                _checklist_item("claim_readiness", "Submit ready claim", "Run claim readiness and submit only cases with eligibility and coding complete.", "/billing", "ready"),
                _checklist_item("denial_rework", "Rework denial", "Move a denied case through rework and resubmission.", "/billing", "ready"),
                _checklist_item("remittance", "Record payment", "Record payment or remittance placeholder and confirm timeline/audit visibility.", "/billing", "ready"),
            ],
        ),
        _role_checklist(
            "manager",
            "Manager",
            "Own readiness evidence, launch blockers, integrations, access review, audit export, and go-live sign-off.",
            [
                _checklist_item("go_live_packet", "Review go-live packet", "Review evidence, blockers, and latest manager attestation.", "/operations", "attention" if workplan["blocking_count"] else "ready"),
                _checklist_item("credential_preflight", "Review credential preflight", "Confirm each integration has credentials, connection tests, and sandbox evidence.", "/integrations", "attention" if preflight["blocking_count"] else "ready"),
                _checklist_item("access_review", "Review staff access", "Review role assignments, MFA gaps, stale access reviews, and inactive accounts.", "/staff", "ready"),
                _checklist_item("audit_export", "Export audit evidence", "Export audit events for sensitive workflow activity and launch packet support.", "/operations", "ready"),
            ],
        ),
    ]
    return {
        "generated_at": datetime.now(UTC),
        "roles": roles,
        "total_roles": len(roles),
        "ready_roles": sum(1 for role in roles if role["status"] == "ready"),
        "attention_roles": sum(1 for role in roles if role["status"] == "attention"),
    }


async def start_role_dry_run_session(db: AsyncSession, user: User, data: dict) -> dict:
    checklist = await role_dry_run_checklists(db, user)
    session_id = str(uuid4())
    payload = _recalculate_dry_run_totals({
        "session_id": session_id,
        "session_name": data.get("session_name") or "Clinic dry run",
        "status": "in_progress",
        "note": data.get("note"),
        "started_by": user.display_name,
        "completed_by": None,
        "started_at": datetime.now(UTC).isoformat(),
        "completed_at": None,
        "checklist_generated_at": checklist["generated_at"].isoformat()
        if hasattr(checklist["generated_at"], "isoformat")
        else checklist["generated_at"],
        "roles": [
            {
                **role,
                "items": [
                    {
                        **item,
                        "dry_run_status": "pending",
                        "note": None,
                    }
                    for item in role["items"]
                ],
            }
            for role in checklist["roles"]
        ],
    })
    event = await log_event(
        db,
        ROLE_DRY_RUN_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _dry_run_session_from_audit(event)


async def list_role_dry_run_sessions(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == ROLE_DRY_RUN_SESSION_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(200))
    sessions: dict[str, dict] = {}
    for event in result.scalars().all():
        session = _dry_run_session_from_audit(event)
        sessions.setdefault(session["session_id"], session)
    return list(sessions.values())[:25], len(sessions)


async def update_role_dry_run_session(db: AsyncSession, user: User, session_id: str, data: dict) -> dict | None:
    latest = await _latest_dry_run_session_event(db, user, session_id)
    if not latest:
        return None

    payload = deepcopy(latest.payload or {})
    if data.get("note") is not None:
        payload["note"] = data["note"]
    if data.get("session_status"):
        payload["status"] = data["session_status"]
        if data["session_status"] == "completed" and not payload.get("completed_at"):
            payload["completed_at"] = datetime.now(UTC).isoformat()
            payload["completed_by"] = user.display_name

    role_key = data.get("role_key")
    item_key = data.get("item_key")
    if role_key or item_key:
        updated = False
        for role in payload.get("roles", []):
            if role.get("key") != role_key:
                continue
            for item in role.get("items", []):
                if item.get("key") != item_key:
                    continue
                if data.get("dry_run_status"):
                    item["dry_run_status"] = data["dry_run_status"]
                if data.get("item_note") is not None:
                    item["note"] = data["item_note"]
                updated = True
                break
            break
        if not updated:
            return None

    payload = _recalculate_dry_run_totals(payload)
    event = await log_event(
        db,
        ROLE_DRY_RUN_SESSION_EVENT_TYPE,
        "operations",
        session_id,
        actor_id=user.id,
        payload=payload,
    )
    return _dry_run_session_from_audit(event)


async def attest_go_live_packet(db: AsyncSession, user: User, data: dict) -> dict:
    packet = await go_live_packet(db, user)
    if data["decision"] == "approved" and not packet["go_live_ready"]:
        raise ValueError(
            f"Go-live approval requires a ready packet; {packet['blocking_count']} blocking item(s) remain."
        )
    payload = {
        "decision": data["decision"],
        "note": data.get("note"),
        "reviewer_id": user.id,
        "reviewer_name": user.display_name,
        "packet_status": packet["status"],
        "go_live_ready": packet["go_live_ready"],
        "blocking_count": packet["blocking_count"],
        "warning_count": packet["warning_count"],
        "evidence_ready_count": packet["evidence_ready_count"],
        "evidence_total": packet["evidence_total"],
    }
    event = await log_event(
        db,
        GO_LIVE_ATTESTATION_EVENT_TYPE,
        "operations",
        user.organization_id,
        actor_id=user.id,
        payload=payload,
    )
    return _go_live_attestation_from_audit(event)


async def list_go_live_attestations(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == GO_LIVE_ATTESTATION_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(10))
    return [_go_live_attestation_from_audit(item) for item in result.scalars().all()], total


async def create_launch_workplan_snapshot(db: AsyncSession, user: User) -> dict:
    workplan = await launch_workplan(db, user)
    event = await log_event(
        db,
        LAUNCH_WORKPLAN_SNAPSHOT_EVENT_TYPE,
        "operations",
        user.organization_id,
        actor_id=user.id,
        payload=_serialize_launch_workplan(workplan),
    )
    return _launch_workplan_snapshot_from_audit(event)


async def list_launch_workplan_snapshots(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == LAUNCH_WORKPLAN_SNAPSHOT_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(25))
    return [_launch_workplan_snapshot_from_audit(item) for item in result.scalars().all()], total


async def create_rehearsal_snapshot(db: AsyncSession, user: User) -> dict:
    report = await production_rehearsal_report(db, user)
    event = await log_event(
        db,
        REHEARSAL_SNAPSHOT_EVENT_TYPE,
        "operations",
        user.organization_id,
        actor_id=user.id,
        payload=_serialize_rehearsal_report(report),
    )
    return _rehearsal_snapshot_from_audit(event)


async def list_rehearsal_snapshots(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == REHEARSAL_SNAPSHOT_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(25))
    return [_rehearsal_snapshot_from_audit(item) for item in result.scalars().all()], total


def rehearsal_report_csv(report: dict) -> str:
    rows = ["section,key,label,status,score,detail,route,severity,owner,assignment_status,due_date,note"]
    for gate in report["gates"]:
        rows.append(_csv_row([
            "gate",
            gate["key"],
            gate["label"],
            gate["status"],
            str(gate["score"]),
            gate["detail"],
            gate["route"],
            "",
            "",
            "",
            "",
            "",
        ]))
    for action in report["recommended_actions"]:
        assignment = action.get("assignment") or {}
        rows.append(_csv_row([
            "action",
            action["key"],
            action["label"],
            "",
            "",
            action["detail"],
            action["route"],
            action["severity"],
            assignment.get("owner_name", ""),
            assignment.get("status", ""),
            assignment.get("due_date", "") or "",
            assignment.get("note", "") or "",
        ]))
    return "\n".join(rows) + "\n"


def launch_workplan_csv(workplan: dict) -> str:
    rows = ["key,source,category,label,severity,detail,route,owner_role,recommended_action,owner,assignment_status,due_date,note"]
    for item in workplan["items"]:
        assignment = item.get("assignment") or {}
        rows.append(_csv_row([
            item["key"],
            item["source"],
            item["category"],
            item["label"],
            item["severity"],
            item["detail"],
            item["route"],
            item["owner_role"],
            item["recommended_action"],
            assignment.get("owner_name", ""),
            assignment.get("status", ""),
            assignment.get("due_date", "") or "",
            assignment.get("note", "") or "",
        ]))
    return "\n".join(rows) + "\n"


def credential_dry_run_binder_csv(binder: dict) -> str:
    rows = [
        "integration,label,binder_status,credential_status,readiness_mode,production_ready,vendor_name,owner_name,owner_email,handoff_archive_status,handoff_archive_reference,sandbox_reference_count,sandbox_reference_total,blockers,route"
    ]
    for item in binder["items"]:
        profile = item["vendor_profile"]
        archive = item["handoff_archive"]
        rows.append(_csv_row([
            item["integration"],
            item["label"],
            item["binder_status"],
            item["status"],
            item["readiness_mode"],
            str(item["production_ready"]).lower(),
            profile.get("vendor_name", ""),
            profile.get("owner_name", ""),
            profile.get("owner_email", ""),
            archive["status"],
            archive.get("archive_reference_url") or "",
            str(item["sandbox_reference_count"]),
            str(item["sandbox_reference_total"]),
            "; ".join(item["blockers"]),
            item["route"],
        ]))
    return "\n".join(rows) + "\n"


def live_use_rehearsal_csv(dashboard: dict) -> str:
    rows = ["section,key,label,status,detail,route"]
    for gate in dashboard["gates"]:
        rows.append(_csv_row([
            "gate",
            gate["key"],
            gate["label"],
            gate["status"],
            gate["detail"],
            gate["route"],
        ]))
    for evidence in dashboard["evidence"]:
        rows.append(_csv_row([
            "evidence",
            evidence["key"],
            evidence["label"],
            evidence["status"],
            evidence["detail"],
            evidence["route"],
        ]))
    for action in dashboard["next_actions"]:
        rows.append(_csv_row([
            "action",
            action["key"],
            action["label"],
            action["severity"],
            action["detail"],
            action["route"],
        ]))
    return "\n".join(rows) + "\n"


def cutover_runbook_csv(session: dict) -> str:
    rows = ["phase,key,label,status,owner,note,rollback_trigger"]
    for phase in session["phases"]:
        for step in phase["steps"]:
            rows.append(_csv_row([
                phase["key"],
                step["key"],
                step["label"],
                step["step_status"],
                step.get("owner_name") or "",
                step.get("note") or "",
                step.get("rollback_trigger") or "",
            ]))
    rows.append(_csv_row([
        "rollback_decision",
        "rollback_status",
        "Rollback status",
        session["rollback_status"],
        session.get("cutover_owner") or "",
        session.get("rollback_decision") or "",
        "",
    ]))
    return "\n".join(rows) + "\n"


async def _rehearsal_assignments_by_key(db: AsyncSession, user: User) -> dict[str, dict]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == REHEARSAL_ASSIGNMENT_EVENT_TYPE,
        AuditLog.entity_type == "operations",
    ).order_by(AuditLog.created_at.desc())
    result = await db.execute(query)
    assignments: dict[str, dict] = {}
    for event in result.scalars().all():
        assignment = _rehearsal_assignment_from_audit(event)
        assignments.setdefault(assignment["action_key"], assignment)
    return assignments


async def _rehearsal_closeout_status(db: AsyncSession, user: User) -> dict:
    org = user.organization_id

    async def count(model, *clauses) -> int:
        result = await db.execute(select(func.count(model.id)).where(model.organization_id == org, *clauses))
        return result.scalar() or 0

    urgent_tasks = await count(Task, Task.status.in_([TaskStatus.open, TaskStatus.in_progress, TaskStatus.blocked]), Task.priority == TaskPriority.urgent)
    documents = await count(PatientDocument, PatientDocument.status == PatientDocumentStatus.needs_review)
    unsigned = await count(PatientEncounter, PatientEncounter.status.in_([EncounterStatus.draft, EncounterStatus.provider_review]))
    failed_integrations = await count(IntegrationEvent, IntegrationEvent.status == IntegrationEventStatus.failed)
    blockers = urgent_tasks + documents + unsigned + failed_integrations
    return {
        "status": "clear" if blockers == 0 else "attention",
        "score": max(0, 100 - blockers * 10),
        "urgent_tasks": urgent_tasks,
        "documents": documents,
        "unsigned": unsigned,
        "failed_integrations": failed_integrations,
        "detail": f"{urgent_tasks} urgent task(s), {documents} document(s), {unsigned} unsigned encounter(s), {failed_integrations} failed integration event(s).",
    }


def _gate(key: str, label: str, status: str, score: int, detail: str, route: str) -> dict:
    return {
        "key": key,
        "label": label,
        "status": status,
        "score": max(0, min(100, int(score))),
        "detail": detail,
        "route": route,
    }


def _live_gate(key: str, label: str, status: str, detail: str, route: str, captured_at) -> dict:
    return {
        "key": key,
        "label": label,
        "status": status,
        "detail": detail,
        "route": route,
        "captured_at": captured_at,
    }


def _live_gate_from_evidence(key: str, label: str, evidence: dict | None) -> dict:
    if not evidence:
        return _live_gate(
            key,
            label,
            "missing",
            f"{label} evidence is missing.",
            "/operations",
            None,
        )
    return _live_gate(
        key,
        label,
        evidence["status"],
        evidence["detail"],
        evidence["route"],
        evidence.get("captured_at"),
    )


def _live_use_next_actions(gates: list[dict], workplan_items: list[dict], preflight_items: list[dict]) -> list[dict]:
    actions = [
        {
            "key": f"gate_{gate['key']}",
            "label": f"Resolve {gate['label']}",
            "detail": gate["detail"],
            "route": gate["route"],
            "severity": "blocking" if gate["status"] in {"blocking", "missing"} else "warning",
        }
        for gate in gates
        if gate["status"] != "ready"
    ]
    actions.extend(
        {
            "key": f"workplan_{item['key']}",
            "label": item["label"],
            "detail": item["recommended_action"],
            "route": item["route"],
            "severity": item["severity"],
        }
        for item in workplan_items[:8]
    )
    actions.extend(
        {
            "key": f"credential_{item['key']}",
            "label": f"{item['label']} credential preflight",
            "detail": "; ".join(item.get("blockers") or ["Complete credential, connection, and sandbox evidence."]),
            "route": "/integrations",
            "severity": "blocking" if item.get("status") in {"missing", "blocked"} else "warning",
        }
        for item in preflight_items
        if item.get("status") != "ready"
    )
    deduped: dict[str, dict] = {}
    for action in actions:
        deduped.setdefault(action["key"], action)
    return sorted(
        deduped.values(),
        key=lambda item: (0 if item["severity"] == "blocking" else 1, item["label"]),
    )


def _backup_restore_detail(deployment: dict) -> str:
    backup = deployment.get("latest_backup", {})
    restore = deployment.get("latest_restore", {})
    if backup.get("ok") and restore.get("ok"):
        return "Latest backup and restore evidence are present."
    if backup.get("ok"):
        return "Backup evidence exists, but restore validation is missing."
    return "Backup and restore validation evidence is missing."


def _document_storage_config_gap_count() -> int:
    checks = [
        bool(settings.minio_endpoint),
        bool(settings.minio_bucket),
        settings.minio_access_key != DEFAULT_MINIO_ACCESS_KEY,
        settings.minio_secret_key != DEFAULT_MINIO_SECRET_KEY,
        settings.minio_secure,
    ]
    return sum(1 for ready in checks if not ready)


def _document_storage_signing_gap_count() -> int:
    probe_url = f"s3://{settings.minio_bucket}/readiness/probe-document.pdf"
    checks = [
        bool(patient_document_service._presigned_put_url(probe_url)),
        bool(patient_document_service._presigned_get_url(probe_url)),
    ]
    return sum(1 for ready in checks if not ready)


def _document_storage_handoff(event: AuditLog) -> dict:
    payload = event.payload or {}
    expires_at = _parse_optional_datetime(payload.get("expires_at"))
    expired = bool(expires_at and expires_at < datetime.now(UTC).replace(tzinfo=None))
    storage_status = payload.get("storage_status") or (
        "metadata_only"
        if payload.get("has_file") is False
        else "signed_handoff"
        if event.event_type == "patient_document.download_handoff"
        else "unknown"
    )
    return {
        "document_id": event.entity_id,
        "patient_id": payload.get("patient_id"),
        "occurred_at": event.created_at,
        "storage_status": storage_status,
        "presigned": bool(payload.get("presigned")),
        "expires_at": expires_at or payload.get("expires_at"),
        "expired": expired,
    }


def _parse_optional_datetime(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _document_storage_check(
    key: str,
    label: str,
    count: int,
    severity: str,
    detail: str,
    recommended_action: str,
) -> dict:
    return {
        "key": key,
        "label": label,
        "status": "triggered" if count else "clear",
        "severity": severity,
        "count": count,
        "detail": detail,
        "recommended_action": recommended_action,
        "route": "/operations",
    }


def _document_storage_alert_detail(readiness: dict) -> str:
    summary = readiness["summary"]
    if readiness["status"] == "ready":
        return "Document storage readiness checks are clear."
    return (
        f"{summary['config_gaps']} config gap(s), "
        f"{summary['metadata_only_documents']} metadata-only document(s), "
        f"{summary['unsigned_handoffs']} unsigned handoff(s), and "
        f"{summary['expired_handoffs']} expired handoff(s)."
    )


def _role_access_severity(matrix: dict) -> str:
    return "critical" if any(item["severity"] == "critical" for item in matrix["warnings"]) else "warning"


def _role_access_detail(matrix: dict) -> str:
    if not matrix["warnings"]:
        return "Role coverage and privileged access checks are clear."
    summary = matrix["summary"]
    return (
        f"{len(matrix['warnings'])} role access warning(s), "
        f"{summary['privileged_users_without_mfa']} privileged MFA gap(s), and "
        f"{summary['roles_without_active_users']} role coverage gap(s)."
    )


def _role_access_health(matrix: dict) -> dict:
    warnings = len(matrix["warnings"])
    privileged_gaps = matrix["summary"]["privileged_users_without_mfa"]
    coverage_gaps = matrix["summary"]["roles_without_active_users"]
    status = "critical" if privileged_gaps else "warning" if warnings else "healthy"
    score = max(0, 100 - privileged_gaps * 25 - coverage_gaps * 15 - max(0, warnings - privileged_gaps - coverage_gaps) * 10)
    return _operator_check(
        "role_access_matrix",
        "Role access matrix",
        status,
        score,
        _role_access_detail(matrix),
        "/staff",
        matrix["generated_at"],
        role_access_warnings=warnings,
        privileged_mfa_gaps=privileged_gaps,
        roles_without_active_users=coverage_gaps,
    )


def _timeline_item_from_audit(event: AuditLog) -> dict:
    critical_types = {"auth.login_blocked", "user.password_reset_issued"}
    title_map = {
        "auth.login_blocked": "Blocked login",
        "user.password_reset_issued": "Password reset issued",
        "auth.password_rotated": "Password rotated",
        "audit.exported": "Audit export",
        "patient_document.download_handoff": "Document download handoff",
        "patient_document.accessed": "Document accessed",
        "integration_event.retry": "Integration retry",
    }
    return {
        "key": f"audit_event:{event.event_type}",
        "occurred_at": event.created_at,
        "severity": "critical" if event.event_type in critical_types else "warning",
        "category": "security"
        if event.event_type.startswith(("auth.", "user."))
        else "compliance"
        if event.event_type == "audit.exported"
        else "document",
        "title": title_map.get(event.event_type, event.event_type.replace("_", " ").replace(".", " ").title()),
        "detail": _audit_timeline_detail(event),
        "source": "audit",
        "route": "/staff" if event.event_type.startswith(("auth.", "user.")) else "/operations",
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
    }


def _audit_timeline_detail(event: AuditLog) -> str:
    if event.event_type == "auth.login_blocked":
        return f"Login blocked: {event.payload.get('reason', 'policy')}"
    if event.event_type == "user.password_reset_issued":
        return "A temporary password reset was issued and requires review."
    if event.event_type == "audit.exported":
        return _audit_export_event_detail(event)
    if event.event_type == "patient_document.download_handoff":
        return "A signed document download handoff was prepared."
    if event.event_type == "patient_document.accessed":
        return "Patient document access was recorded."
    return f"{event.event_type} recorded."


def _alert_rule(
    key: str,
    label: str,
    triggered: bool,
    severity: str,
    count: int,
    detail: str,
    route: str,
    last_triggered_at,
) -> dict:
    return {
        "key": key,
        "label": label,
        "status": "triggered" if triggered else "clear",
        "severity": severity,
        "count": count,
        "detail": detail,
        "route": route,
        "last_triggered_at": last_triggered_at,
    }


def _blocked_login_detail(events: list[AuditLog]) -> str:
    if not events:
        return "No blocked login events recorded."
    reason = events[0].payload.get("reason", "policy")
    return f"{len(events)} blocked login event(s). Latest reason: {reason}."


def _audit_export_detail(events: list[AuditLog]) -> str:
    if not events:
        return "No audit export events recorded."
    latest = events[0]
    row_count = latest.payload.get("row_count", 0)
    filters = _audit_export_filter_summary(latest.payload.get("filters") or {})
    return f"{len(events)} audit export event(s). Latest exported {row_count} row(s){filters}."


def _audit_export_event_detail(event: AuditLog) -> str:
    row_count = event.payload.get("row_count", 0)
    filters = _audit_export_filter_summary(event.payload.get("filters") or {})
    return f"Audit export generated with {row_count} row(s){filters}."


def _audit_export_filter_summary(filters: dict) -> str:
    applied = [
        f"{key}={value}"
        for key, value in filters.items()
        if value not in {None, ""}
    ]
    return f" for {', '.join(applied)}" if applied else ""


def _restore_drill_item(key: str, label: str, detail: str, docs: list[str]) -> dict:
    return {
        "key": key,
        "label": label,
        "detail": detail,
        "route": "/operations",
        "status": "attention",
        "docs": docs,
    }


def restore_drill_session_csv(session: dict) -> str:
    rows = [[
        "session_id",
        "session_name",
        "owner_name",
        "status",
        "backup_reference",
        "rto_minutes",
        "rpo_minutes",
        "item_key",
        "item_label",
        "drill_status",
        "note",
    ]]
    for item in session.get("items", []):
        rows.append([
            session["session_id"],
            session["session_name"],
            session.get("owner_name") or "",
            session["status"],
            session.get("backup_reference") or "",
            "" if session.get("rto_minutes") is None else str(session.get("rto_minutes")),
            "" if session.get("rpo_minutes") is None else str(session.get("rpo_minutes")),
            item["key"],
            item["label"],
            item["drill_status"],
            item.get("note") or "",
        ])
    return "\n".join(_csv_row([str(value) for value in row]) for row in rows) + "\n"


def _workplan_item(
    *,
    key: str,
    source: str,
    category: str,
    label: str,
    detail: str,
    severity: str,
    route: str,
    owner_role: str,
    recommended_action: str,
    assignment: dict | None = None,
) -> dict:
    return {
        "key": key,
        "source": source,
        "category": category,
        "label": label,
        "detail": detail,
        "severity": severity,
        "route": route,
        "owner_role": owner_role,
        "recommended_action": recommended_action,
        "assignment": assignment,
    }


def _packet_evidence(key: str, label: str, status: str, detail: str, route: str, captured_at) -> dict:
    return {
        "key": key,
        "label": label,
        "status": status,
        "detail": detail,
        "route": route,
        "captured_at": captured_at,
    }


def _credential_binder_item(item: dict, archive: dict | None) -> dict:
    missing_steps = [
        step["label"]
        for step in item.get("steps", [])
        if step.get("status") != "ready"
    ]
    blockers = list(item.get("blockers") or [])
    sandbox_reference_count = sum(
        1
        for evidence in item.get("sandbox_evidence", [])
        if evidence.get("status") == "passed" and _is_vendor_reference_url(evidence.get("reference_url"))
    )
    sandbox_reference_total = len(item.get("sandbox_tests", []))
    handoff_archive = _credential_binder_archive(item, archive)
    if item.get("status") in {"missing", "blocked"}:
        binder_status = "blocking"
    elif handoff_archive["status"] == "missing" and item.get("production_ready"):
        binder_status = "blocking"
    elif (
        item.get("readiness_mode") == "production_vendor"
        and sandbox_reference_total > 0
        and sandbox_reference_count < sandbox_reference_total
    ):
        binder_status = "blocking"
        blockers.append("Vendor sandbox reference URLs are required for every passed workflow before launch review.")
    elif item.get("status") == "staged" or handoff_archive["status"] in {"missing", "warning"} or missing_steps:
        binder_status = "warning"
    else:
        binder_status = "ready"
    return {
        "integration": item["key"],
        "label": item["label"],
        "status": item["status"],
        "binder_status": binder_status,
        "readiness_mode": item["readiness_mode"],
        "configured": item["configured"],
        "healthy": item["healthy"],
        "adapter_implemented": item["adapter_implemented"],
        "production_ready": item["production_ready"],
        "sandbox_ready": item["sandbox_ready"],
        "mode": item["mode"],
        "vendor_profile": item["vendor_profile"],
        "cutover_evidence": item["cutover_evidence"],
        "risk_register": item["risk_register"],
        "handoff_archive": handoff_archive,
        "sandbox_reference_count": sandbox_reference_count,
        "sandbox_reference_total": sandbox_reference_total,
        "sandbox_evidence_count": sum(1 for evidence in item.get("sandbox_evidence", []) if evidence.get("status") == "passed"),
        "missing_steps": missing_steps,
        "blockers": blockers,
        "route": "/integrations",
    }


def _credential_binder_archive(item: dict, archive: dict | None) -> dict:
    if not archive:
        return {
            "status": "missing",
            "detail": f"{item['label']} handoff packet has not been archived for launch review.",
            "archive_reference_url": None,
            "archived_at": None,
        }
    if not archive.get("archive_reference_url"):
        return {
            "status": "warning",
            "detail": f"{item['label']} handoff packet is archived but missing a launch evidence reference.",
            "archive_reference_url": None,
            "archived_at": archive.get("archived_at"),
        }
    return {
        "status": "ready",
        "detail": f"{item['label']} handoff packet archive is linked to launch evidence.",
        "archive_reference_url": archive.get("archive_reference_url"),
        "archived_at": archive.get("archived_at"),
    }


def _is_vendor_reference_url(reference_url: str | None) -> bool:
    return bool(reference_url and not reference_url.strip().lower().startswith("sandbox://"))


async def _vendor_handoff_archive_packet_evidence(db: AsyncSession | None, user: User, preflight: dict) -> dict:
    required = [
        item
        for item in preflight.get("data", [])
        if item.get("readiness_mode") == "production_vendor"
        and item.get("production_ready")
        and item.get("status") == "ready"
    ]
    if not required:
        return _packet_evidence(
            "vendor_handoff_archives",
            "Vendor handoff archives",
            "warning",
            "No production-vendor-ready integrations are available for handoff packet archive review.",
            "/integrations",
            None,
        )

    archives = await _latest_vendor_handoff_archives(db, user)
    missing = [item["label"] for item in required if item["key"] not in archives]
    archived_without_reference = [
        item["label"]
        for item in required
        if item["key"] in archives and not archives[item["key"]].get("archive_reference_url")
    ]
    captured_at = max(
        (archives[item["key"]]["archived_at"] for item in required if item["key"] in archives),
        default=None,
    )

    if missing:
        return _packet_evidence(
            "vendor_handoff_archives",
            "Vendor handoff archives",
            "blocking",
            f"{len(missing)} production integration handoff packet archive(s) missing: {', '.join(missing)}.",
            "/integrations",
            captured_at,
        )
    if archived_without_reference:
        return _packet_evidence(
            "vendor_handoff_archives",
            "Vendor handoff archives",
            "warning",
            f"{len(archived_without_reference)} archived handoff packet(s) need a launch evidence reference: {', '.join(archived_without_reference)}.",
            "/integrations",
            captured_at,
        )
    return _packet_evidence(
        "vendor_handoff_archives",
        "Vendor handoff archives",
        "ready",
        f"{len(required)} production integration handoff packet archive(s) recorded for launch review.",
        "/integrations",
        captured_at,
    )


async def _latest_vendor_handoff_archives(db: AsyncSession | None, user: User) -> dict[str, dict]:
    if db is None:
        return {}
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.event_type == integration_config_service.HANDOFF_PACKET_ARCHIVE_EVENT,
        AuditLog.entity_type == "integration_config",
    ).order_by(AuditLog.created_at.desc())
    result = await db.execute(query)
    archives: dict[str, dict] = {}
    for event in result.scalars().all():
        payload = event.payload or {}
        integration = str(payload.get("integration") or event.entity_id or "").strip()
        if not integration or integration in archives:
            continue
        archives[integration] = {
            "integration": integration,
            "archive_reference_url": payload.get("archive_reference_url"),
            "archived_at": event.created_at,
        }
    return archives


def _readiness_snapshot_packet_status(snapshot: dict | None) -> str:
    if not snapshot:
        return "missing"
    if snapshot["core_status"] != "ok" or snapshot["critical_count"] > 0:
        return "blocking"
    if snapshot["operational_status"] != "ok" or snapshot["warning_count"] > 0:
        return "warning"
    return "ready"


def _readiness_snapshot_packet_detail(snapshot: dict) -> str:
    return (
        f"Core {snapshot['core_status']}, operational {snapshot['operational_status']}, "
        f"launch score {snapshot['launch_score']}, {snapshot['critical_count']} critical and "
        f"{snapshot['warning_count']} warning incident(s) captured."
    )


def _config_check(
    key: str,
    category: str,
    label: str,
    ready: bool,
    severity: str,
    detail: str,
    action: str,
    env_vars: list[str],
    docs: list[str],
) -> dict:
    return {
        "key": key,
        "category": category,
        "label": label,
        "ready": bool(ready),
        "severity": severity,
        "detail": detail,
        "action": action,
        "env_vars": env_vars,
        "docs": docs,
    }


def _browser_qa_item(key: str, label: str, detail: str, route: str, category: str) -> dict:
    return {
        "key": key,
        "label": label,
        "detail": detail,
        "route": route,
        "category": category,
    }


def _training_item(key: str, label: str, detail: str, route: str, category: str) -> dict:
    return {
        "key": key,
        "label": label,
        "detail": detail,
        "route": route,
        "category": category,
    }


def _training_role(key: str, label: str, summary: str, items: list[dict]) -> dict:
    return {
        "key": key,
        "label": label,
        "summary": summary,
        "items": items,
    }


def _policy_item(key: str, label: str, detail: str, route: str, category: str, docs: list[str]) -> dict:
    return {
        "key": key,
        "label": label,
        "detail": detail,
        "route": route,
        "category": category,
        "docs": docs,
    }


def _cutover_step(
    key: str,
    label: str,
    detail: str,
    owner_role: str,
    expected_minute: int,
    rollback_trigger: str | None,
) -> dict:
    return {
        "key": key,
        "label": label,
        "detail": detail,
        "owner_role": owner_role,
        "expected_minute": expected_minute,
        "rollback_trigger": rollback_trigger,
    }


def _cutover_phase(key: str, label: str, objective: str, steps: list[dict]) -> dict:
    return {
        "key": key,
        "label": label,
        "objective": objective,
        "steps": steps,
    }


def _cors_origins_are_production_safe() -> bool:
    origins = settings.cors_origin_list
    if not origins:
        return False
    for origin in origins:
        if origin == "*" or origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1"):
            return False
        if not origin.startswith("https://"):
            return False
    return True


def _operator_check(
    key: str,
    label: str,
    status: str,
    score: int,
    detail: str,
    route: str,
    last_seen_at=None,
    **extra,
) -> dict:
    return {
        "key": key,
        "label": label,
        "status": status,
        "score": max(0, min(100, int(score))),
        "detail": detail,
        "route": route,
        "last_seen_at": last_seen_at,
        **extra,
    }


def _operator_action(check: dict) -> dict:
    return {
        "key": f"resolve_{check['key']}",
        "label": f"Resolve {check['label']}",
        "detail": check["detail"],
        "severity": check["status"],
        "route": check["route"],
    }


def _freshness_check(
    key: str,
    label: str,
    marker: dict,
    *,
    stale_after: timedelta,
    missing_status: str,
    route: str,
) -> dict:
    last_seen = marker.get("last_success_at")
    parsed = _parse_datetime(last_seen)
    if not marker.get("ok") or not parsed:
        return _operator_check(
            key,
            label,
            missing_status,
            0 if missing_status == "critical" else 45,
            marker.get("error") or f"{label} evidence is missing.",
            route,
            last_seen,
        )
    age = datetime.now(UTC) - parsed
    if age > stale_after:
        return _operator_check(
            key,
            label,
            "warning",
            65,
            f"Last successful {label.lower()} was {age.days} day(s) ago.",
            route,
            last_seen,
        )
    return _operator_check(
        key,
        label,
        "healthy",
        100,
        f"Last successful {label.lower()} is current.",
        route,
        last_seen,
    )


async def _integration_failure_health(db: AsyncSession, user: User) -> dict:
    result = await db.execute(
        select(
            func.count(IntegrationEvent.id),
            func.max(IntegrationEvent.updated_at),
        ).where(
            IntegrationEvent.organization_id == user.organization_id,
            IntegrationEvent.status == IntegrationEventStatus.failed,
        )
    )
    failed_count, latest_at = result.one()
    latest_error = None
    if failed_count:
        latest = await db.execute(
            select(IntegrationEvent).where(
                IntegrationEvent.organization_id == user.organization_id,
                IntegrationEvent.status == IntegrationEventStatus.failed,
            ).order_by(IntegrationEvent.updated_at.desc()).limit(1)
        )
        latest_event = latest.scalar_one_or_none()
        latest_error = latest_event.error if latest_event else None
    return _operator_check(
        "integration_failures",
        "Integration failures",
        "critical" if failed_count else "healthy",
        max(0, 100 - int(failed_count or 0) * 20),
        f"{failed_count or 0} failed integration event(s)."
        + (f" Latest: {latest_error}" if latest_error else ""),
        "/integrations",
        latest_at,
        failed_count=int(failed_count or 0),
    )


def _parse_datetime(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _checklist_item(key: str, label: str, detail: str, route: str, status: str) -> dict:
    return {
        "key": key,
        "label": label,
        "detail": detail,
        "route": route,
        "status": status,
    }


def _role_checklist(key: str, label: str, summary: str, items: list[dict]) -> dict:
    attention = sum(1 for item in items if item["status"] != "ready")
    return {
        "key": key,
        "label": label,
        "summary": summary,
        "status": "attention" if attention else "ready",
        "ready_count": sum(1 for item in items if item["status"] == "ready"),
        "attention_count": attention,
        "total": len(items),
        "items": items,
    }


async def _latest_browser_qa_session_event(db: AsyncSession, user: User, session_id: str) -> AuditLog | None:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == BROWSER_QA_SESSION_EVENT_TYPE,
            AuditLog.entity_type == "operations",
            AuditLog.entity_id == session_id,
        ).order_by(AuditLog.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def _recalculate_browser_qa_totals(payload: dict) -> dict:
    item_count = 0
    passed_count = 0
    failed_count = 0
    pending_count = 0
    for item in payload.get("items", []):
        item_count += 1
        status = item.get("qa_status") or "pending"
        if status == "passed":
            passed_count += 1
        elif status == "failed":
            failed_count += 1
        else:
            pending_count += 1
    payload["item_count"] = item_count
    payload["passed_count"] = passed_count
    payload["failed_count"] = failed_count
    payload["pending_count"] = pending_count
    return payload


def _browser_qa_session_from_audit(event: AuditLog) -> dict:
    payload = _recalculate_browser_qa_totals(deepcopy(event.payload or {}))
    return {
        "id": event.id,
        "session_id": payload.get("session_id") or event.entity_id,
        "session_name": payload.get("session_name") or "Browser QA run",
        "browser": payload.get("browser"),
        "status": payload.get("status", "in_progress"),
        "note": payload.get("note"),
        "started_by": payload.get("started_by"),
        "completed_by": payload.get("completed_by"),
        "started_at": payload.get("started_at") or event.created_at,
        "updated_at": event.created_at,
        "completed_at": payload.get("completed_at"),
        "item_count": int(payload.get("item_count", 0)),
        "passed_count": int(payload.get("passed_count", 0)),
        "failed_count": int(payload.get("failed_count", 0)),
        "pending_count": int(payload.get("pending_count", 0)),
        "items": payload.get("items", []),
    }


async def _latest_staff_training_session_event(db: AsyncSession, user: User, session_id: str) -> AuditLog | None:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == STAFF_TRAINING_SESSION_EVENT_TYPE,
            AuditLog.entity_type == "operations",
            AuditLog.entity_id == session_id,
        ).order_by(AuditLog.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def _recalculate_staff_training_totals(payload: dict) -> dict:
    item_count = 0
    signed_count = 0
    reviewed_count = 0
    pending_count = 0
    for role in payload.get("roles", []):
        for item in role.get("items", []):
            item_count += 1
            status = item.get("training_status") or "pending"
            if status == "signed":
                signed_count += 1
            elif status == "reviewed":
                reviewed_count += 1
            else:
                pending_count += 1
    payload["item_count"] = item_count
    payload["signed_count"] = signed_count
    payload["reviewed_count"] = reviewed_count
    payload["pending_count"] = pending_count
    return payload


def _staff_training_session_from_audit(event: AuditLog) -> dict:
    payload = _recalculate_staff_training_totals(deepcopy(event.payload or {}))
    return {
        "id": event.id,
        "session_id": payload.get("session_id") or event.entity_id,
        "session_name": payload.get("session_name") or "Staff training",
        "trainer_name": payload.get("trainer_name"),
        "status": payload.get("status", "in_progress"),
        "note": payload.get("note"),
        "started_by": payload.get("started_by"),
        "completed_by": payload.get("completed_by"),
        "started_at": payload.get("started_at") or event.created_at,
        "updated_at": event.created_at,
        "completed_at": payload.get("completed_at"),
        "item_count": int(payload.get("item_count", 0)),
        "signed_count": int(payload.get("signed_count", 0)),
        "reviewed_count": int(payload.get("reviewed_count", 0)),
        "pending_count": int(payload.get("pending_count", 0)),
        "roles": payload.get("roles", []),
    }


async def _latest_restore_drill_session_event(db: AsyncSession, user: User, session_id: str) -> AuditLog | None:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == RESTORE_DRILL_SESSION_EVENT_TYPE,
            AuditLog.entity_type == "operations",
            AuditLog.entity_id == session_id,
        ).order_by(AuditLog.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def _recalculate_restore_drill_totals(payload: dict) -> dict:
    item_count = 0
    complete_count = 0
    blocked_count = 0
    pending_count = 0
    for item in payload.get("items", []):
        item_count += 1
        status = item.get("drill_status") or "pending"
        if status == "complete":
            complete_count += 1
        elif status == "blocked":
            blocked_count += 1
        else:
            pending_count += 1
    payload["item_count"] = item_count
    payload["complete_count"] = complete_count
    payload["blocked_count"] = blocked_count
    payload["pending_count"] = pending_count
    return payload


def _restore_drill_session_from_audit(event: AuditLog) -> dict:
    payload = _recalculate_restore_drill_totals(deepcopy(event.payload or {}))
    return {
        "id": event.id,
        "session_id": payload.get("session_id") or event.entity_id,
        "session_name": payload.get("session_name") or "Restore drill",
        "owner_name": payload.get("owner_name"),
        "backup_reference": payload.get("backup_reference"),
        "status": payload.get("status", "in_progress"),
        "note": payload.get("note"),
        "started_by": payload.get("started_by"),
        "completed_by": payload.get("completed_by"),
        "started_at": payload.get("started_at") or event.created_at,
        "updated_at": event.created_at,
        "completed_at": payload.get("completed_at"),
        "rto_minutes": payload.get("rto_minutes"),
        "rpo_minutes": payload.get("rpo_minutes"),
        "item_count": int(payload.get("item_count", 0)),
        "complete_count": int(payload.get("complete_count", 0)),
        "blocked_count": int(payload.get("blocked_count", 0)),
        "pending_count": int(payload.get("pending_count", 0)),
        "items": payload.get("items", []),
    }


async def _latest_policy_approval_session_event(db: AsyncSession, user: User, session_id: str) -> AuditLog | None:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == POLICY_APPROVAL_SESSION_EVENT_TYPE,
            AuditLog.entity_type == "operations",
            AuditLog.entity_id == session_id,
        ).order_by(AuditLog.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def _recalculate_policy_approval_totals(payload: dict) -> dict:
    item_count = 0
    approved_count = 0
    needs_changes_count = 0
    pending_count = 0
    for item in payload.get("items", []):
        item_count += 1
        status = item.get("approval_status") or "pending"
        if status == "approved":
            approved_count += 1
        elif status == "needs_changes":
            needs_changes_count += 1
        else:
            pending_count += 1
    payload["item_count"] = item_count
    payload["approved_count"] = approved_count
    payload["needs_changes_count"] = needs_changes_count
    payload["pending_count"] = pending_count
    return payload


def _policy_approval_session_from_audit(event: AuditLog) -> dict:
    payload = _recalculate_policy_approval_totals(deepcopy(event.payload or {}))
    return {
        "id": event.id,
        "session_id": payload.get("session_id") or event.entity_id,
        "session_name": payload.get("session_name") or "Policy approval",
        "reviewer_name": payload.get("reviewer_name"),
        "status": payload.get("status", "in_progress"),
        "note": payload.get("note"),
        "started_by": payload.get("started_by"),
        "completed_by": payload.get("completed_by"),
        "started_at": payload.get("started_at") or event.created_at,
        "updated_at": event.created_at,
        "completed_at": payload.get("completed_at"),
        "item_count": int(payload.get("item_count", 0)),
        "approved_count": int(payload.get("approved_count", 0)),
        "needs_changes_count": int(payload.get("needs_changes_count", 0)),
        "pending_count": int(payload.get("pending_count", 0)),
        "items": payload.get("items", []),
    }


async def _latest_cutover_runbook_session_event(db: AsyncSession, user: User, session_id: str) -> AuditLog | None:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == CUTOVER_RUNBOOK_SESSION_EVENT_TYPE,
            AuditLog.entity_type == "operations",
            AuditLog.entity_id == session_id,
        ).order_by(AuditLog.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def _recalculate_cutover_totals(payload: dict) -> dict:
    step_count = 0
    complete_count = 0
    blocked_count = 0
    rollback_count = 0
    pending_count = 0
    for phase in payload.get("phases", []):
        for step in phase.get("steps", []):
            step_count += 1
            status = step.get("step_status") or "pending"
            if status == "complete":
                complete_count += 1
            elif status == "blocked":
                blocked_count += 1
            elif status == "rollback":
                rollback_count += 1
            else:
                pending_count += 1
    payload["step_count"] = step_count
    payload["complete_count"] = complete_count
    payload["blocked_count"] = blocked_count
    payload["rollback_count"] = rollback_count
    payload["pending_count"] = pending_count
    return payload


def _cutover_runbook_session_from_audit(event: AuditLog) -> dict:
    payload = _recalculate_cutover_totals(deepcopy(event.payload or {}))
    return {
        "id": event.id,
        "session_id": payload.get("session_id") or event.entity_id,
        "session_name": payload.get("session_name") or "Production cutover rehearsal",
        "cutover_owner": payload.get("cutover_owner"),
        "scheduled_for": payload.get("scheduled_for"),
        "status": payload.get("status", "in_progress"),
        "rollback_status": payload.get("rollback_status", "not_reviewed"),
        "rollback_decision": payload.get("rollback_decision"),
        "note": payload.get("note"),
        "started_by": payload.get("started_by"),
        "completed_by": payload.get("completed_by"),
        "started_at": payload.get("started_at") or event.created_at,
        "updated_at": event.created_at,
        "completed_at": payload.get("completed_at"),
        "step_count": int(payload.get("step_count", 0)),
        "complete_count": int(payload.get("complete_count", 0)),
        "blocked_count": int(payload.get("blocked_count", 0)),
        "rollback_count": int(payload.get("rollback_count", 0)),
        "pending_count": int(payload.get("pending_count", 0)),
        "phases": payload.get("phases", []),
    }


async def _latest_dry_run_session_event(db: AsyncSession, user: User, session_id: str) -> AuditLog | None:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == ROLE_DRY_RUN_SESSION_EVENT_TYPE,
            AuditLog.entity_type == "operations",
            AuditLog.entity_id == session_id,
        ).order_by(AuditLog.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def _recalculate_dry_run_totals(payload: dict) -> dict:
    item_count = 0
    complete_count = 0
    blocked_count = 0
    pending_count = 0
    for role in payload.get("roles", []):
        for item in role.get("items", []):
            item_count += 1
            status = item.get("dry_run_status") or "pending"
            if status == "complete":
                complete_count += 1
            elif status == "blocked":
                blocked_count += 1
            else:
                pending_count += 1
    payload["item_count"] = item_count
    payload["complete_count"] = complete_count
    payload["blocked_count"] = blocked_count
    payload["pending_count"] = pending_count
    return payload


def _dry_run_session_from_audit(event: AuditLog) -> dict:
    payload = _recalculate_dry_run_totals(deepcopy(event.payload or {}))
    return {
        "id": event.id,
        "session_id": payload.get("session_id") or event.entity_id,
        "session_name": payload.get("session_name") or "Clinic dry run",
        "status": payload.get("status", "in_progress"),
        "note": payload.get("note"),
        "started_by": payload.get("started_by"),
        "completed_by": payload.get("completed_by"),
        "started_at": payload.get("started_at") or event.created_at,
        "updated_at": event.created_at,
        "completed_at": payload.get("completed_at"),
        "checklist_generated_at": payload.get("checklist_generated_at"),
        "item_count": int(payload.get("item_count", 0)),
        "complete_count": int(payload.get("complete_count", 0)),
        "blocked_count": int(payload.get("blocked_count", 0)),
        "pending_count": int(payload.get("pending_count", 0)),
        "roles": payload.get("roles", []),
    }


def _dedupe_workplan_items(items: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for item in items:
        existing = by_key.get(item["key"])
        if not existing:
            by_key[item["key"]] = item
            continue
        if item["severity"] == "blocking":
            existing["severity"] = "blocking"
        if item.get("assignment") and not existing.get("assignment"):
            existing["assignment"] = item["assignment"]
    return sorted(
        by_key.values(),
        key=lambda item: (
            0 if item["severity"] == "blocking" else 1,
            item["category"],
            item["label"],
        ),
    )


def _serialize_rehearsal_report(report: dict) -> dict:
    return {
        **report,
        "generated_at": report["generated_at"].isoformat() if hasattr(report["generated_at"], "isoformat") else report["generated_at"],
    }


def _serialize_launch_workplan(workplan: dict) -> dict:
    return {
        **workplan,
        "generated_at": workplan["generated_at"].isoformat() if hasattr(workplan["generated_at"], "isoformat") else workplan["generated_at"],
    }


def _rehearsal_snapshot_from_audit(event: AuditLog) -> dict:
    payload = event.payload or {}
    return {
        "id": event.id,
        "created_at": event.created_at,
        "status": payload.get("status", "attention"),
        "rehearsal_ready": bool(payload.get("rehearsal_ready")),
        "score": int(payload.get("score", 0)),
        "blocking_count": int(payload.get("blocking_count", 0)),
        "warning_count": int(payload.get("warning_count", 0)),
        "recommended_action_count": len(payload.get("recommended_actions", [])),
    }


def _launch_workplan_snapshot_from_audit(event: AuditLog) -> dict:
    payload = event.payload or {}
    return {
        "id": event.id,
        "created_at": event.created_at,
        "status": payload.get("status", "attention"),
        "total": int(payload.get("total", 0)),
        "blocking_count": int(payload.get("blocking_count", 0)),
        "warning_count": int(payload.get("warning_count", 0)),
        "assigned_count": int(payload.get("assigned_count", 0)),
        "unassigned_count": int(payload.get("unassigned_count", 0)),
        "unassigned_blocking_count": int(payload.get("unassigned_blocking_count", 0)),
    }


def _go_live_attestation_from_audit(event: AuditLog) -> dict:
    payload = event.payload or {}
    return {
        "id": event.id,
        "created_at": event.created_at,
        "decision": payload.get("decision", "needs_changes"),
        "note": payload.get("note"),
        "reviewer_id": payload.get("reviewer_id") or event.actor_id,
        "reviewer_name": payload.get("reviewer_name"),
        "packet_status": payload.get("packet_status", "attention"),
        "go_live_ready": bool(payload.get("go_live_ready")),
        "blocking_count": int(payload.get("blocking_count", 0)),
        "warning_count": int(payload.get("warning_count", 0)),
        "evidence_ready_count": int(payload.get("evidence_ready_count", 0)),
        "evidence_total": int(payload.get("evidence_total", 0)),
    }


def _rehearsal_assignment_from_audit(event: AuditLog) -> dict:
    payload = event.payload or {}
    return {
        "id": event.id,
        "action_key": payload.get("action_key") or event.entity_id,
        "owner_id": payload.get("owner_id"),
        "owner_name": payload.get("owner_name", "Unassigned"),
        "status": payload.get("status", "open"),
        "due_date": payload.get("due_date"),
        "note": payload.get("note"),
        "assigned_by": payload.get("assigned_by"),
        "assigned_at": event.created_at,
    }


def _csv_row(values: list[str]) -> str:
    escaped = []
    for value in values:
        if any(char in value for char in [",", '"', "\n"]):
            escaped.append('"' + value.replace('"', '""') + '"')
        else:
            escaped.append(value)
    return ",".join(escaped)


def _readiness_incidents(readiness: dict) -> list[dict]:
    incidents = []
    for key, check in readiness.get("checks", {}).items():
        if not check.get("ok"):
            incidents.append(_incident(
                key=f"core_{key}",
                title=f"{key.replace('_', ' ').title()} degraded",
                severity="critical",
                source="readiness",
                status="open",
                owner_role="operations",
                count=1,
                detail=_check_detail(check),
                recommended_action="Restore core infrastructure before clinical use.",
                route="/operations",
            ))
    for key, check in readiness.get("integrations", {}).items():
        if check.get("ok"):
            continue
        incidents.append(_incident(
            key=f"integration_{key}",
            title=f"{key.replace('_', ' ').title()} not live",
            severity="critical" if check.get("configured") else "warning",
            source="readiness",
            status="setup_required" if not check.get("configured") else "open",
            owner_role="operations",
            count=1,
            detail=_check_detail(check),
            recommended_action="Connect credentials, test the adapter, and rerun readiness.",
            route="/integrations",
        ))
    return incidents


def _launch_incidents(launch: dict) -> list[dict]:
    incidents = []
    for requirement in launch.get("requirements", []):
        if requirement.get("ready"):
            continue
        incidents.append(_incident(
            key=f"launch_{requirement['key']}",
            title=requirement["label"],
            severity=requirement["severity"],
            source="launch_readiness",
            status="open",
            owner_role="operations",
            count=1,
            detail=requirement["detail"],
            recommended_action=requirement["action"],
            route="/setup",
        ))
    return incidents


async def _integration_event_incidents(db: AsyncSession, user: User) -> list[dict]:
    result = await db.execute(
        select(
            IntegrationEvent.integration,
            func.count(IntegrationEvent.id),
            func.max(IntegrationEvent.error),
        ).where(
            IntegrationEvent.organization_id == user.organization_id,
            IntegrationEvent.status == IntegrationEventStatus.failed,
        ).group_by(IntegrationEvent.integration)
    )
    return [
        _incident(
            key=f"integration_event_{integration}",
            title=f"{integration.replace('_', ' ').title()} failed events",
            severity="critical",
            source="integration_events",
            status="open",
            owner_role="operations",
            count=count,
            detail=error or "Integration event failed.",
            recommended_action="Review the failed event payload, retry it, or contact the vendor.",
            route="/operations",
        )
        for integration, count, error in result.all()
    ]


def _dedupe_incidents(incidents: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for incident in incidents:
        existing = by_key.get(incident["key"])
        if not existing:
            by_key[incident["key"]] = incident
            continue
        existing["count"] += incident["count"]
        if incident["severity"] == "critical":
            existing["severity"] = "critical"
    return sorted(
        by_key.values(),
        key=lambda item: (0 if item["severity"] == "critical" else 1, item["title"]),
    )


def _incident(
    *,
    key: str,
    title: str,
    severity: str,
    source: str,
    status: str,
    owner_role: str,
    count: int,
    detail: str,
    recommended_action: str,
    route: str,
) -> dict:
    return {
        "key": key,
        "title": title,
        "severity": severity,
        "source": source,
        "status": status,
        "owner_role": owner_role,
        "count": int(count or 0),
        "detail": detail,
        "recommended_action": recommended_action,
        "route": route,
    }


def _check_detail(check: dict) -> str:
    if check.get("error"):
        return f"Failing with {check['error']}."
    if check.get("configured") is False:
        env_var = check.get("env_var")
        return f"Missing {env_var}." if env_var else "Not configured."
    return "Needs operational review."


def _snapshot_from_audit(event: AuditLog) -> dict:
    payload = event.payload or {}
    return {
        "id": event.id,
        "created_at": event.created_at,
        "operational_status": payload.get("operational_status", "degraded"),
        "core_status": payload.get("core_status", "degraded"),
        "launch_score": int(payload.get("launch_score", 0)),
        "incident_count": int(payload.get("incident_count", 0)),
        "critical_count": int(payload.get("critical_count", 0)),
        "warning_count": int(payload.get("warning_count", 0)),
    }
