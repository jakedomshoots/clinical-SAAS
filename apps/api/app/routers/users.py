from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, manager_write_required
from app.models.user import User
from app.schemas.user import UserDirectoryListOut, UserDirectoryOut, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
ManagerUserDep = Annotated[User, Depends(manager_write_required)]


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


@router.patch("/{user_id}", response_model=UserDirectoryOut)
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: DbDep,
    current_user: ManagerUserDep,
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    try:
        user = await user_service.update_user(db, current_user, user_id, update_data)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserDirectoryOut.model_validate(user)
