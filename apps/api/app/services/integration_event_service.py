from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration_event import IntegrationEvent, IntegrationEventStatus
from app.models.user import User


async def record_event(
    db: AsyncSession,
    user: User,
    *,
    integration: str,
    direction: str,
    action: str,
    status: str = IntegrationEventStatus.pending.value,
    entity_type: str | None = None,
    entity_id: str | None = None,
    idempotency_key: str | None = None,
    payload: dict | None = None,
    error: str | None = None,
) -> IntegrationEvent:
    event = IntegrationEvent(
        organization_id=user.organization_id,
        integration=integration,
        direction=direction,
        action=action,
        status=IntegrationEventStatus(status),
        entity_type=entity_type,
        entity_id=entity_id,
        idempotency_key=idempotency_key,
        payload=payload or {},
        error=error,
        attempts=1,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def list_events(
    db: AsyncSession,
    user: User,
    *,
    page: int = 1,
    page_size: int = 20,
    integration: str | None = None,
    status: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> tuple[list[IntegrationEvent], int]:
    query = select(IntegrationEvent).where(
        IntegrationEvent.organization_id == user.organization_id
    )
    count_query = select(func.count(IntegrationEvent.id)).where(
        IntegrationEvent.organization_id == user.organization_id
    )

    if integration:
        query = query.where(IntegrationEvent.integration == integration)
        count_query = count_query.where(IntegrationEvent.integration == integration)
    if status:
        query = query.where(IntegrationEvent.status == IntegrationEventStatus(status))
        count_query = count_query.where(IntegrationEvent.status == IntegrationEventStatus(status))
    if entity_type:
        query = query.where(IntegrationEvent.entity_type == entity_type)
        count_query = count_query.where(IntegrationEvent.entity_type == entity_type)
    if entity_id:
        query = query.where(IntegrationEvent.entity_id == entity_id)
        count_query = count_query.where(IntegrationEvent.entity_id == entity_id)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(IntegrationEvent.created_at.desc()).offset(offset).limit(page_size)
    )
    return list(result.scalars().all()), total


async def find_by_idempotency_key(
    db: AsyncSession,
    organization_id: str,
    idempotency_key: str,
) -> IntegrationEvent | None:
    result = await db.execute(
        select(IntegrationEvent).where(
            IntegrationEvent.organization_id == organization_id,
            IntegrationEvent.idempotency_key == idempotency_key,
        )
    )
    return result.scalar_one_or_none()


async def mark_retrying(db: AsyncSession, user: User, event_id: str) -> IntegrationEvent | None:
    result = await db.execute(
        select(IntegrationEvent).where(
            IntegrationEvent.id == event_id,
            IntegrationEvent.organization_id == user.organization_id,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        return None
    event.status = IntegrationEventStatus.retrying
    event.attempts += 1
    await db.commit()
    await db.refresh(event)
    return event
