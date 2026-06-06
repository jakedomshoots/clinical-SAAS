from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.audit_service import log_event

ACCESS_REVIEW_WINDOW_DAYS = 90
PRIVILEGED_ROLES = {UserRole.admin, UserRole.manager}


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


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
        "mfa_enabled": user.mfa_enabled,
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
                "mfa_enabled": user.mfa_enabled,
            },
        },
    )
    return user


async def access_review_summary(
    db: AsyncSession,
    current_user: User,
) -> dict:
    rows = (
        await db.execute(
            select(User)
            .where(User.organization_id == current_user.organization_id)
            .order_by(User.role.asc(), User.display_name.asc())
        )
    ).scalars().all()
    items = [_access_review_item(user) for user in rows]
    return {
        "data": items,
        "total": len(items),
        "due_count": sum(1 for item in items if item["review_status"] == "needs_review"),
        "privileged_without_mfa_count": sum(
            1
            for item in items
            if "privileged_mfa_missing" in item["findings"]
        ),
        "inactive_count": sum(1 for user in rows if not user.is_active),
        "review_window_days": ACCESS_REVIEW_WINDOW_DAYS,
    }


async def mark_access_reviewed(
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
    if current_user.role != UserRole.admin and user.role == UserRole.admin:
        raise PermissionError("Managers cannot review admin access")

    before = {
        "mfa_enabled": user.mfa_enabled,
        "access_reviewed_at": user.access_reviewed_at.isoformat() if user.access_reviewed_at else None,
    }
    if "mfa_enabled" in data and data["mfa_enabled"] is not None:
        user.mfa_enabled = data["mfa_enabled"]
    if "note" in data:
        user.access_review_note = data["note"]
    user.access_reviewed_at = _utcnow()
    user.access_reviewed_by_id = current_user.id

    await db.commit()
    await db.refresh(user)
    await log_event(
        db,
        "user.access_reviewed",
        "user",
        user.id,
        actor_id=current_user.id,
        payload={
            "reviewed_user_role": user.role.value,
            "before": before,
            "after": {
                "mfa_enabled": user.mfa_enabled,
                "access_reviewed_at": user.access_reviewed_at.isoformat() if user.access_reviewed_at else None,
            },
        },
    )
    return user


def _access_review_item(user: User) -> dict:
    findings: list[str] = []
    if not user.is_active:
        findings.append("inactive_account")
    if user.role in PRIVILEGED_ROLES and not user.mfa_enabled:
        findings.append("privileged_mfa_missing")
    if user.access_reviewed_at is None:
        findings.append("never_reviewed")
    elif user.access_reviewed_at < _utcnow() - timedelta(days=ACCESS_REVIEW_WINDOW_DAYS):
        findings.append("stale_review")
    if user.last_login_at is None:
        findings.append("never_logged_in")

    actionable = [
        finding
        for finding in findings
        if finding in {"inactive_account", "privileged_mfa_missing", "never_reviewed", "stale_review"}
    ]
    return {
        "user": user,
        "review_status": "needs_review" if actionable else "current",
        "findings": findings,
        "recommended_action": _recommended_action(findings),
    }


def _recommended_action(findings: list[str]) -> str:
    if "privileged_mfa_missing" in findings:
        return "Require MFA enrollment before production use."
    if "inactive_account" in findings:
        return "Confirm whether this account should remain inactive or be removed from access."
    if "never_reviewed" in findings:
        return "Review role, employment status, and access need."
    if "stale_review" in findings:
        return f"Refresh access review; policy window is {ACCESS_REVIEW_WINDOW_DAYS} days."
    if "never_logged_in" in findings:
        return "Account has no recorded login; confirm onboarding status."
    return "No action required."
