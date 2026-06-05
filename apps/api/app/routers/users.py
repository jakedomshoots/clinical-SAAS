from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserDirectoryListOut, UserDirectoryOut
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=UserDirectoryListOut)
async def list_users(
    db: DbDep,
    current_user: CurrentUserDep,
    role: str | None = Query(None),
    is_active: bool | None = Query(True),
):
    data, total = await user_service.list_users(
        db,
        current_user,
        role=role,
        is_active=is_active,
    )
    return UserDirectoryListOut(
        data=[UserDirectoryOut.model_validate(item) for item in data],
        total=total,
    )
