from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, manager_write_required
from app.models.user import User
from app.schemas.user import (
    UserAccessReviewItemOut,
    UserAccessReviewSummaryOut,
    UserAccessReviewUpdate,
    RoleAccessMatrixOut,
    RoleAccessMatrixRoleOut,
    RoleAccessMatrixWarningOut,
    UserDirectoryListOut,
    UserDirectoryOut,
    UserPasswordResetOut,
    UserRecoveryItemOut,
    UserRecoverySummaryOut,
    UserUpdate,
)
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


@router.get("/access-review", response_model=UserAccessReviewSummaryOut)
async def access_review_summary(
    db: DbDep,
    current_user: ManagerUserDep,
):
    summary = await user_service.access_review_summary(db, current_user)
    return UserAccessReviewSummaryOut(
        data=[
            UserAccessReviewItemOut(
                user=UserDirectoryOut.model_validate(item["user"]),
                review_status=item["review_status"],
                findings=item["findings"],
                recommended_action=item["recommended_action"],
            )
            for item in summary["data"]
        ],
        total=summary["total"],
        due_count=summary["due_count"],
        privileged_without_mfa_count=summary["privileged_without_mfa_count"],
        inactive_count=summary["inactive_count"],
        review_window_days=summary["review_window_days"],
    )


@router.get("/recovery-summary", response_model=UserRecoverySummaryOut)
async def recovery_summary(
    db: DbDep,
    current_user: ManagerUserDep,
):
    summary = await user_service.recovery_summary(db, current_user)
    return UserRecoverySummaryOut(
        data=[UserRecoveryItemOut(**item) for item in summary["data"]],
        total=summary["total"],
        temporary_password_count=summary["temporary_password_count"],
        expired_temporary_password_count=summary["expired_temporary_password_count"],
    )


@router.get("/role-access-matrix", response_model=RoleAccessMatrixOut)
async def get_role_access_matrix(
    db: DbDep,
    current_user: ManagerUserDep,
):
    matrix = await user_service.role_access_matrix(db, current_user)
    return RoleAccessMatrixOut(
        generated_at=matrix["generated_at"],
        total_roles=matrix["total_roles"],
        summary=matrix["summary"],
        roles=[RoleAccessMatrixRoleOut(**item) for item in matrix["roles"]],
        warnings=[RoleAccessMatrixWarningOut(**item) for item in matrix["warnings"]],
    )


@router.post("/{user_id}/password-reset", response_model=UserPasswordResetOut)
async def issue_password_reset(
    user_id: str,
    db: DbDep,
    current_user: ManagerUserDep,
):
    try:
        reset = await user_service.issue_password_reset(db, current_user, user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if not reset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user, temporary_password = reset
    return UserPasswordResetOut(
        user=UserDirectoryOut.model_validate(user),
        temporary_password=temporary_password,
        temporary_password_expires_at=user.temporary_password_expires_at,
    )


@router.post("/{user_id}/access-review", response_model=UserDirectoryOut)
async def mark_access_reviewed(
    user_id: str,
    data: UserAccessReviewUpdate,
    db: DbDep,
    current_user: ManagerUserDep,
):
    try:
        user = await user_service.mark_access_reviewed(
            db,
            current_user,
            user_id,
            data.model_dump(exclude_unset=True),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserDirectoryOut.model_validate(user)


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
