from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.audit_service import log_event


async def list_users(
    db: AsyncSession,
    current_user: User,
    role: str | None = None,
    is_active: bool | None = True,
) -> tuple[list[User], int]:
    query = select(User).where(User.organization_id == current_user.organization_id)
    countq = select(func.count(User.id)).where(User.organization_id == current_user.organization_id)
    if role:
        query = query.where(User.role == UserRole(role))
        countq = countq.where(User.role == UserRole(role))
    if is_active is not None:
        query = query.where(User.is_active == is_active)
        countq = countq.where(User.is_active == is_active)

    total = (await db.execute(countq)).scalar() or 0
    rows = (
        await db.execute(query.order_by(User.role.asc(), User.display_name.asc()))
    ).scalars().all()
    return list(rows), total


async def update_user(
    db: AsyncSession,
    current_user: User,
    user_id: str,
    data: dict,
) -> User | None:
    user = (
        await db.execute(
            select(User).where(
                User.id == user_id,
                User.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not user:
        return None
    if current_user.role != UserRole.admin:
        requested_role = data.get("role")
        if user.role == UserRole.admin or requested_role == UserRole.admin.value:
            raise PermissionError("Managers cannot grant or modify admin access")
        if user.id == current_user.id and ("role" in data or "is_active" in data):
            raise PermissionError("Managers cannot change their own role or active status")
    before = {
        "display_name": user.display_name,
        "role": user.role.value,
        "is_active": user.is_active,
    }
    for field, value in data.items():
        if field == "role" and value is not None:
            user.role = UserRole(value)
        elif hasattr(user, field):
            setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    await log_event(
        db,
        "user.updated",
        "user",
        user.id,
        actor_id=current_user.id,
        payload={
            "updated_fields": list(data.keys()),
            "before": before,
            "after": {
                "display_name": user.display_name,
                "role": user.role.value,
                "is_active": user.is_active,
            },
        },
    )
    return user
