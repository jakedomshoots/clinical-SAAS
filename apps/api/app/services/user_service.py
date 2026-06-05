from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


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
