from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, front_office_write_required
from app.models.user import User
from app.schemas.assistant import (
    AssistantFaxMatchRequest,
    AssistantFollowUpTaskRequest,
    AssistantPortalReplyDraftRequest,
)
from app.schemas.fax import FaxOut
from app.schemas.message import MessageOut
from app.schemas.task import TaskOut
from app.services import assistant_service

router = APIRouter(prefix="/api/assistant/actions", tags=["assistant"])


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
