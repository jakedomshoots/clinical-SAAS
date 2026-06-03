from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.message import MessageOut, MessageSend, ThreadListOut, ThreadOut
from app.services import message_service

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("/threads", response_model=ThreadListOut)
async def list_threads(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    data, total = await message_service.list_threads(db, current_user.id)
    return ThreadListOut(data=[ThreadOut(**t) for t in data], total=total)


@router.get("/threads/{thread_id}", response_model=list[MessageOut])
async def list_messages(thread_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = await message_service.list_messages(db, thread_id)
    return [MessageOut(**m) for m in data]


@router.post("", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(data: MessageSend, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = await message_service.send_message(db, current_user, data.model_dump())
    return MessageOut(**msg)


@router.get("/{message_id}", response_model=MessageOut)
async def get_message(message_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = await message_service.get_message(db, message_id)
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return MessageOut(**msg)


@router.post("/{message_id}/read", response_model=MessageOut)
async def mark_read(message_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = await message_service.mark_read(db, current_user, message_id)
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return MessageOut(**msg)
