import json
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
