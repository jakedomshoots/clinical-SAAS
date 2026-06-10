from datetime import UTC, datetime
from uuid import uuid4

from app.schemas.assistant import AssistantProposalCreate, AssistantProposalOut

_PROPOSALS: dict[str, AssistantProposalOut] = {}


def create_proposal(data: AssistantProposalCreate, user_id: str) -> AssistantProposalOut:
    proposal = AssistantProposalOut(
        **data.model_dump(),
        id=str(uuid4()),
        status="pending",
        created_at=datetime.now(UTC),
        created_by_user_id=user_id,
    )
    _PROPOSALS[proposal.id] = proposal
    return proposal


def list_pending_proposals() -> list[AssistantProposalOut]:
    return sorted(
        [proposal for proposal in _PROPOSALS.values() if proposal.status == "pending"],
        key=lambda proposal: proposal.created_at,
        reverse=True,
    )


def resolve_proposal(
    proposal_id: str,
    status: str,
    user_id: str,
) -> AssistantProposalOut | None:
    proposal = _PROPOSALS.get(proposal_id)
    if proposal is None:
        return None
    if proposal.status != "pending":
        return proposal
    updated = proposal.model_copy(
        update={
            "status": status,
            "resolved_at": datetime.now(UTC),
            "resolved_by_user_id": user_id,
        }
    )
    _PROPOSALS[proposal_id] = updated
    return updated


def clear_proposals_for_tests() -> None:
    _PROPOSALS.clear()
