from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import clinical_write_required, front_office_write_required, get_current_user
from app.models.user import User
from app.schemas.assistant import (
    AssistantCommandRequest,
    AssistantCommandResult,
    AssistantContextOut,
    AssistantFaxMatchRequest,
    AssistantFollowUpTaskRequest,
    AssistantPolicyOut,
    AssistantPortalReplyDraftRequest,
    AssistantProposalCreate,
    AssistantProposalOut,
    AssistantRouteContext,
    AssistantUserContext,
    AssistantWorkSummary,
)
from app.schemas.fax import FaxOut
from app.schemas.message import MessageOut
from app.schemas.task import TaskOut
from app.services import assistant_commands, assistant_proposals, assistant_service
from app.services.assistant_policy import allowed_tools_for

router = APIRouter(prefix="/api/assistant/actions", tags=["assistant"])


def _assistant_route_label(path: str) -> tuple[str, str | None, str | None]:
    if path.startswith("/patients/"):
        return "Patient chart", "patient", path.split("/")[2]
    if path.startswith("/patients"):
        return "Patient search", None, None
    if path.startswith("/tasks"):
        return "Task queue", None, None
    if path.startswith("/scheduling"):
        return "Schedule", None, None
    if path.startswith("/faxes"):
        return "Fax center", None, None
    if path.startswith("/messaging"):
        return "Messages", None, None
    if path.startswith("/billing"):
        return "Billing", None, None
    if path.startswith("/operations"):
        return "Operations", None, None
    if path.startswith("/setup"):
        return "Setup checklist", None, None
    if path.startswith("/assistant-review"):
        return "AI review", None, None
    return "Command center", None, None


@router.get("/policy", response_model=AssistantPolicyOut)
async def get_assistant_policy(current_user: User = Depends(get_current_user)):  # noqa: B008
    return AssistantPolicyOut(allowed_tools=allowed_tools_for(current_user))


@router.get("/context", response_model=AssistantContextOut)
async def get_assistant_context(
    path: str = "/",
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    label, entity_type, entity_id = _assistant_route_label(path)
    return AssistantContextOut(
        route=AssistantRouteContext(
            path=path,
            label=label,
            entity_type=entity_type,
            entity_id=entity_id,
        ),
        user=AssistantUserContext(
            id=str(current_user.id),
            role=current_user.role.value,
            display_name=current_user.display_name,
        ),
        allowed_tools=allowed_tools_for(current_user),
        work_summary=AssistantWorkSummary(),
        assistant_rules=[
            "Stage proposed actions only.",
            "Require ConciergeOS confirmation before writes.",
            "Do not state that an action was completed until ConciergeOS confirms it.",
        ],
    )


@router.post("/proposals", response_model=AssistantProposalOut, status_code=status.HTTP_201_CREATED)
async def create_assistant_proposal(
    data: AssistantProposalCreate,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    return await assistant_proposals.create_proposal(db, data, current_user)


@router.get("/proposals", response_model=list[AssistantProposalOut])
async def list_assistant_proposals(
    route_path: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    return await assistant_proposals.list_pending_proposals(
        db,
        current_user,
        route_path=route_path,
        entity_type=entity_type,
        entity_id=entity_id,
    )


@router.post(
    "/commands",
    response_model=AssistantCommandResult,
    status_code=status.HTTP_201_CREATED,
)
async def submit_assistant_command(
    data: AssistantCommandRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    if not settings.native_ai_commands_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Native AI commands are disabled",
        )
    result = await assistant_commands.interpret_command(db, current_user, data)
    if result.result_type != "proposal":
        response.status_code = status.HTTP_200_OK
    return result


# Proposal confirmation is intentionally handled by the web client calling the
# existing confirmation-gated assistant action endpoints with the staged payload.
# This keeps clinical writes on established role-gated, audit-visible paths.
@router.post("/proposals/{proposal_id}/confirm", response_model=AssistantProposalOut)
async def confirm_assistant_proposal(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    proposal, resolution_error = await assistant_proposals.resolve_proposal(
        db,
        proposal_id,
        "confirmed",
        current_user,
    )
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if resolution_error == "expired":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Proposal has expired")
    return proposal


@router.post("/proposals/{proposal_id}/dismiss", response_model=AssistantProposalOut)
async def dismiss_assistant_proposal(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    proposal, resolution_error = await assistant_proposals.resolve_proposal(
        db,
        proposal_id,
        "dismissed",
        current_user,
    )
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if resolution_error == "expired":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Proposal has expired")
    return proposal


@router.post("/follow-up-task", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_follow_up_task(
    data: AssistantFollowUpTaskRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(clinical_write_required),  # noqa: B008
):
    task = await assistant_service.create_follow_up_task(db, current_user, data.model_dump())
    return TaskOut(**task)


@router.post("/portal-reply-draft", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def draft_portal_reply(
    data: AssistantPortalReplyDraftRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(clinical_write_required),  # noqa: B008
):
    message = await assistant_service.draft_portal_reply(db, current_user, data.model_dump())
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")
    return MessageOut(**message)


@router.post("/fax-match", response_model=FaxOut)
async def stage_fax_match(
    data: AssistantFaxMatchRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(front_office_write_required),  # noqa: B008
):
    fax = await assistant_service.stage_fax_match(db, current_user, data.model_dump())
    if not fax:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fax not found")
    return FaxOut(**fax)
