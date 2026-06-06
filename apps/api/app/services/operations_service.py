from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.integration_event import IntegrationEvent, IntegrationEventStatus
from app.models.user import User
from app.services.audit_service import log_event
from app.services.launch_readiness_service import launch_readiness
from app.services.readiness_service import check_readiness

SNAPSHOT_EVENT_TYPE = "operations.readiness_snapshot"


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
