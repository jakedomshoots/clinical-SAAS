import json
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.user import User
from app.redis_client import redis


AUDIT_REVIEW_CATEGORIES = [
    {
        "key": "document_access",
        "label": "Document access",
        "event_types": ["patient_document.accessed", "patient_document.download_handoff"],
        "severity": "critical",
        "route": "/audit?entity_type=patient_document",
        "action_label": "Review document access",
    },
    {
        "key": "assistant_actions",
        "label": "Assistant actions",
        "event_types": [
            "assistant.task_created",
            "assistant.message_drafted",
            "assistant.fax_match_staged",
        ],
        "severity": "warning",
        "route": "/assistant-review",
        "action_label": "Review assistant-confirmed actions",
    },
    {
        "key": "user_administration",
        "label": "User administration",
        "event_types": [
            "user.created",
            "user.updated",
            "user.access_reviewed",
            "auth.login",
            "auth.login_blocked",
        ],
        "severity": "critical",
        "route": "/staff",
        "action_label": "Review staff access changes",
    },
    {
        "key": "patient_outreach",
        "label": "Patient outreach",
        "event_types": ["patient_outreach.staged", "patient_outreach.callback"],
        "severity": "warning",
        "route": "/tasks",
        "action_label": "Review patient outreach",
    },
    {
        "key": "integration_operations",
        "label": "Integration operations",
        "event_types": [
            "integration_event.retry",
            "integration_config.updated",
            "integration_config.connection_test",
            "integration_config.sandbox_evidence",
        ],
        "severity": "warning",
        "route": "/integrations",
        "action_label": "Review integration changes",
    },
]


async def log_event(
    db: AsyncSession,
    event_type: str,
    entity_type: str,
    entity_id: str,
    actor_id: str | None = None,
    payload: dict | None = None,
) -> AuditLog:
    organization_id = "default"
    if actor_id:
        actor = await db.get(User, actor_id)
        if actor:
            organization_id = actor.organization_id

    log_entry = AuditLog(
        organization_id=organization_id,
        actor_id=actor_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload or {},
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    event_message = json.dumps(
        {
            "id": log_entry.id,
            "organization_id": log_entry.organization_id,
            "actor_id": log_entry.actor_id,
            "event_type": log_entry.event_type,
            "entity_type": log_entry.entity_type,
            "entity_id": log_entry.entity_id,
            "payload": log_entry.payload,
            "created_at": log_entry.created_at.isoformat(),
        }
    )
    await redis.publish("events:audit", event_message)

    return log_entry


async def list_events(
    db: AsyncSession,
    user: User,
    page: int = 1,
    page_size: int = 20,
    event_type: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> tuple[list[AuditLog], int]:
    query = select(AuditLog).where(AuditLog.organization_id == user.organization_id)
    count_query = select(func.count(AuditLog.id)).where(
        AuditLog.organization_id == user.organization_id
    )

    if event_type:
        query = query.where(AuditLog.event_type == event_type)
        count_query = count_query.where(AuditLog.event_type == event_type)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
        count_query = count_query.where(AuditLog.entity_id == entity_id)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)
    )
    return list(result.scalars().all()), total


async def list_events_for_export(
    db: AsyncSession,
    user: User,
    event_type: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    limit: int = 10_000,
) -> list[AuditLog]:
    query = select(AuditLog).where(AuditLog.organization_id == user.organization_id)

    if event_type:
        query = query.where(AuditLog.event_type == event_type)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)

    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(limit))
    return list(result.scalars().all())


async def patient_access_history(db: AsyncSession, user, patient_id: str) -> tuple[list[AuditLog], int]:
    query = select(AuditLog).where(
        AuditLog.organization_id == user.organization_id,
        AuditLog.payload["patient_id"].as_string() == patient_id,
        AuditLog.event_type.in_([
            "patient_document.accessed",
            "patient_document.processed",
            "patient_chart.viewed",
            "patient_outreach.staged",
        ]),
    )
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(200))
    rows = list(result.scalars().all())
    return rows, len(rows)


async def review_summary(db: AsyncSession, user: User) -> dict:
    total_event_count = (
        await db.execute(
            select(func.count(AuditLog.id)).where(AuditLog.organization_id == user.organization_id)
        )
    ).scalar() or 0

    categories = []
    sensitive_event_count = 0
    for definition in AUDIT_REVIEW_CATEGORIES:
        event_types = definition["event_types"]
        count = (
            await db.execute(
                select(func.count(AuditLog.id)).where(
                    AuditLog.organization_id == user.organization_id,
                    AuditLog.event_type.in_(event_types),
                )
            )
        ).scalar() or 0
        latest = (
            await db.execute(
                select(func.max(AuditLog.created_at)).where(
                    AuditLog.organization_id == user.organization_id,
                    AuditLog.event_type.in_(event_types),
                )
            )
        ).scalar_one_or_none()
        sensitive_event_count += count
        categories.append({
            "key": definition["key"],
            "label": definition["label"],
            "count": count,
            "severity": definition["severity"] if count else "clear",
            "event_types": event_types,
            "last_event_at": latest,
            "route": definition["route"],
        })

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "total_event_count": total_event_count,
        "sensitive_event_count": sensitive_event_count,
        "categories": categories,
        "recommended_actions": [
            {
                "key": category["key"],
                "label": next(
                    item["action_label"]
                    for item in AUDIT_REVIEW_CATEGORIES
                    if item["key"] == category["key"]
                ),
                "detail": f"{category['count']} sensitive audit event(s) need review.",
                "severity": category["severity"],
                "route": category["route"],
            }
            for category in categories
            if category["count"] > 0
        ],
    }
