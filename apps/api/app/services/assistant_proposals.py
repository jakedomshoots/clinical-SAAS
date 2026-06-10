from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assistant_proposal import AssistantProposal
from app.models.user import User
from app.schemas.assistant import AssistantProposalCreate, AssistantProposalOut
from app.services.audit_service import log_event


def _to_out(proposal: AssistantProposal) -> AssistantProposalOut:
    return AssistantProposalOut(
        id=proposal.id,
        proposal_type=proposal.proposal_type,  # type: ignore[arg-type]
        title=proposal.title,
        summary=proposal.summary,
        route_path=proposal.route_path,
        entity_type=proposal.entity_type,
        entity_id=proposal.entity_id,
        payload=proposal.payload,
        confidence_reason=proposal.confidence_reason,
        source=proposal.source,  # type: ignore[arg-type]
        input_mode=proposal.input_mode,  # type: ignore[arg-type]
        original_command=proposal.original_command,
        status=proposal.status,  # type: ignore[arg-type]
        created_at=proposal.created_at,
        created_by_user_id=proposal.created_by_user_id,
        resolved_at=proposal.resolved_at,
        resolved_by_user_id=proposal.resolved_by_user_id,
        expires_at=proposal.expires_at,
    )


def _normalize_dt(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


async def create_proposal(
    db: AsyncSession,
    data: AssistantProposalCreate,
    user: User,
) -> AssistantProposalOut:
    expires_at = data.expires_at or datetime.now(UTC) + timedelta(hours=24)
    proposal = AssistantProposal(
        organization_id=user.organization_id,
        proposal_type=data.proposal_type,
        title=data.title,
        summary=data.summary,
        route_path=data.route_path,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        payload=data.payload,
        confidence_reason=data.confidence_reason,
        source=data.source,
        input_mode=data.input_mode,
        original_command=data.original_command,
        status="pending",
        created_by_user_id=user.id,
        expires_at=_normalize_dt(expires_at),
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    await log_event(
        db,
        "assistant.proposal_created",
        "assistant_proposal",
        proposal.id,
        actor_id=user.id,
        payload={
            "proposal_type": proposal.proposal_type,
            "source": proposal.source,
            "input_mode": proposal.input_mode,
            "route_path": proposal.route_path,
            "entity_type": proposal.entity_type,
            "entity_id": proposal.entity_id,
        },
    )
    return _to_out(proposal)


async def list_pending_proposals(
    db: AsyncSession,
    user: User,
    route_path: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> list[AssistantProposalOut]:
    now = datetime.now(UTC).replace(tzinfo=None)
    query = select(AssistantProposal).where(
        AssistantProposal.organization_id == user.organization_id,
        AssistantProposal.status == "pending",
        AssistantProposal.expires_at > now,
    )
    if route_path:
        query = query.where(AssistantProposal.route_path == route_path)
    if entity_type:
        query = query.where(AssistantProposal.entity_type == entity_type)
    if entity_id:
        query = query.where(AssistantProposal.entity_id == entity_id)

    result = await db.execute(query.order_by(AssistantProposal.created_at.desc()))
    return [_to_out(proposal) for proposal in result.scalars().all()]


async def resolve_proposal(
    db: AsyncSession,
    proposal_id: str,
    status: str,
    user: User,
) -> tuple[AssistantProposalOut | None, str | None]:
    proposal = await db.get(AssistantProposal, proposal_id)
    if proposal is None or proposal.organization_id != user.organization_id:
        return None, None

    now = datetime.now(UTC).replace(tzinfo=None)
    if proposal.status == "pending" and proposal.expires_at <= now:
        proposal.status = "expired"
        proposal.resolved_at = now
        proposal.resolved_by_user_id = user.id
        await db.commit()
        await db.refresh(proposal)
        await log_event(
            db,
            "assistant.proposal_expired",
            "assistant_proposal",
            proposal.id,
            actor_id=user.id,
            payload={"proposal_type": proposal.proposal_type, "route_path": proposal.route_path},
        )
        return _to_out(proposal), "expired"

    if proposal.status != "pending":
        return _to_out(proposal), None

    proposal.status = status
    proposal.resolved_at = now
    proposal.resolved_by_user_id = user.id
    await db.commit()
    await db.refresh(proposal)
    await log_event(
        db,
        f"assistant.proposal_{status}",
        "assistant_proposal",
        proposal.id,
        actor_id=user.id,
        payload={"proposal_type": proposal.proposal_type, "route_path": proposal.route_path},
    )
    return _to_out(proposal), None


def clear_proposals_for_tests() -> None:
    return None
