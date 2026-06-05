from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, get_current_user
from app.models.user import User
from app.schemas.message import MessageOut, MessageSend, ThreadListOut, ThreadOut
from app.services import message_service

router = APIRouter(prefix="/api/messages", tags=["messages"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
ClinicalUserDep = Annotated[User, Depends(clinical_write_required)]


@router.get("/threads", response_model=ThreadListOut)
async def list_threads(db: DbDep, current_user: CurrentUserDep):
    data, total = await message_service.list_threads(db, current_user)
    return ThreadListOut(data=[ThreadOut(**t) for t in data], total=total)


@router.get("/threads/{thread_id}", response_model=list[MessageOut])
async def list_messages(thread_id: str, db: DbDep, current_user: CurrentUserDep):
    data = await message_service.list_messages(db, current_user, thread_id)
    return [MessageOut(**m) for m in data]


@router.post("", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(data: MessageSend, db: DbDep, current_user: ClinicalUserDep):
    msg = await message_service.send_message(db, current_user, data.model_dump())
    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient or thread not found",
        )
    return MessageOut(**msg)


@router.get("/{message_id}", response_model=MessageOut)
async def get_message(message_id: str, db: DbDep, current_user: CurrentUserDep):
    msg = await message_service.get_message(db, current_user, message_id)
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return MessageOut(**msg)


@router.post("/{message_id}/read", response_model=MessageOut)
async def mark_read(message_id: str, db: DbDep, current_user: ClinicalUserDep):
    msg = await message_service.mark_read(db, current_user, message_id)
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return MessageOut(**msg)
