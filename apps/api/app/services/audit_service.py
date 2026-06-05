import json

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.redis_client import redis


async def log_event(
    db: AsyncSession,
    event_type: str,
    entity_type: str,
    entity_id: str,
    actor_id: str | None = None,
    payload: dict | None = None,
) -> AuditLog:
    log_entry = AuditLog(
        actor_id=actor_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload or {},
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    event_message = json.dumps({
        "id": log_entry.id,
        "actor_id": log_entry.actor_id,
        "event_type": log_entry.event_type,
        "entity_type": log_entry.entity_type,
        "entity_id": log_entry.entity_id,
        "payload": log_entry.payload,
        "created_at": log_entry.created_at.isoformat(),
    })
    await redis.publish("events:audit", event_message)

    return log_entry


async def list_events(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    event_type: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> tuple[list[AuditLog], int]:
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

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
    event_type: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    limit: int = 10_000,
) -> list[AuditLog]:
    query = select(AuditLog)

    if event_type:
        query = query.where(AuditLog.event_type == event_type)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)

    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(limit))
    return list(result.scalars().all())
