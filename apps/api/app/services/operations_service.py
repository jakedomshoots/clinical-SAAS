from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.integration_event import IntegrationEvent, IntegrationEventStatus
from app.models.patient_clinical import EncounterStatus, PatientEncounter
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.services import integration_config_service, user_service
from app.services.audit_service import log_event
from app.services.launch_readiness_service import launch_readiness
from app.services.readiness_service import check_readiness

SNAPSHOT_EVENT_TYPE = "operations.readiness_snapshot"
REHEARSAL_SNAPSHOT_EVENT_TYPE = "operations.production_rehearsal_snapshot"
REHEARSAL_ASSIGNMENT_EVENT_TYPE = "operations.rehearsal_action_assignment"
LAUNCH_WORKPLAN_SNAPSHOT_EVENT_TYPE = "operations.launch_workplan_snapshot"


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
        ))

    deduped = _dedupe_workplan_items(items)
    blocking = sum(1 for item in deduped if item["severity"] == "blocking")
    warnings = sum(1 for item in deduped if item["severity"] == "warning")
    assigned = sum(1 for item in deduped if item.get("assignment"))
    return {
        "status": "clear" if not deduped else "attention",
        "generated_at": datetime.now(UTC),
        "total": len(deduped),
        "blocking_count": blocking,
        "warning_count": warnings,
        "assigned_count": assigned,
        "unassigned_count": len(deduped) - assigned,
        "items": deduped,
    }


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

    urgent_tasks = await count(Task, Task.status.in_([TaskStatus.open, TaskStatus.in_progress]), Task.priority == TaskPriority.urgent)
    documents = await count(PatientDocument, PatientDocument.status == PatientDocumentStatus.needs_review)
    unsigned = await count(PatientEncounter, PatientEncounter.status.in_([EncounterStatus.draft, EncounterStatus.provider_review]))
    failed_integrations = await count(IntegrationEvent, IntegrationEvent.status == IntegrationEventStatus.failed)
    blockers = urgent_tasks + documents + unsigned + failed_integrations
    return {
        "status": "clear" if blockers == 0 else "attention",
        "score": max(0, 100 - blockers * 10),
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


def _backup_restore_detail(deployment: dict) -> str:
    backup = deployment.get("latest_backup", {})
    restore = deployment.get("latest_restore", {})
    if backup.get("ok") and restore.get("ok"):
        return "Latest backup and restore evidence are present."
    if backup.get("ok"):
        return "Backup evidence exists, but restore validation is missing."
    return "Backup and restore validation evidence is missing."


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
