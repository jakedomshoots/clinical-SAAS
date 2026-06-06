from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.audit_service import log_event
from app.services.auth_service import (
    generate_temporary_password,
    hash_password,
    temporary_password_expires_at,
    temporary_password_is_expired,
)

ACCESS_REVIEW_WINDOW_DAYS = 90
PRIVILEGED_ROLES = {UserRole.admin, UserRole.manager}
CLINICAL_WRITE_ROLES = {UserRole.admin, UserRole.manager, UserRole.provider, UserRole.ma}
FRONT_OFFICE_WRITE_ROLES = {UserRole.admin, UserRole.manager, UserRole.front_desk}
MANAGER_ROLES = {UserRole.admin, UserRole.manager}


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


async def issue_password_reset(
    db: AsyncSession,
    current_user: User,
    user_id: str,
) -> tuple[User, str] | None:
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
        raise PermissionError("Managers cannot issue admin password resets")
    if user.id == current_user.id:
        raise PermissionError("Cannot issue a password reset for your own account")

    before = {
        "password_must_change": user.password_must_change,
        "temporary_password_expires_at": (
            user.temporary_password_expires_at.isoformat()
            if user.temporary_password_expires_at
            else None
        ),
    }
    temporary_password = generate_temporary_password()
    user.hashed_password = hash_password(temporary_password)
    user.password_must_change = True
    user.temporary_password_expires_at = temporary_password_expires_at()
    await db.commit()
    await db.refresh(user)
    await log_event(
        db,
        "user.password_reset_issued",
        "user",
        user.id,
        actor_id=current_user.id,
        payload={
            "role": user.role.value,
            "before": before,
            "temporary_password_expires_at": user.temporary_password_expires_at.isoformat()
            if user.temporary_password_expires_at
            else None,
        },
    )
    return user, temporary_password


async def recovery_summary(db: AsyncSession, current_user: User) -> dict:
    rows = (
        await db.execute(
            select(User)
            .where(User.organization_id == current_user.organization_id)
            .order_by(User.role.asc(), User.display_name.asc())
        )
    ).scalars().all()
    data = [_recovery_item(user) for user in rows if user.password_must_change]
    return {
        "data": data,
        "total": len(data),
        "temporary_password_count": len(data),
        "expired_temporary_password_count": sum(
            1 for item in data if item["status"] == "temporary_expired"
        ),
    }


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


async def role_access_matrix(db: AsyncSession, current_user: User) -> dict:
    rows = (
        await db.execute(
            select(User)
            .where(User.organization_id == current_user.organization_id)
            .order_by(User.role.asc(), User.display_name.asc())
        )
    ).scalars().all()
    active_by_role = {
        role: sum(1 for user in rows if user.is_active and user.role == role)
        for role in UserRole
    }
    roles = [_role_matrix_item(role, active_by_role[role]) for role in UserRole]
    warnings = _role_matrix_warnings(rows)
    return {
        "generated_at": _utcnow(),
        "total_roles": len(roles),
        "summary": {
            "active_users": sum(1 for user in rows if user.is_active),
            "inactive_users": sum(1 for user in rows if not user.is_active),
            "privileged_roles": len(PRIVILEGED_ROLES),
            "privileged_users_without_mfa": sum(
                1
                for user in rows
                if user.is_active and user.role in PRIVILEGED_ROLES and not user.mfa_enabled
            ),
            "roles_without_active_users": sum(1 for count in active_by_role.values() if count == 0),
            "access_review_due": sum(
                1
                for item in [_access_review_item(user) for user in rows]
                if item["review_status"] == "needs_review"
            ),
        },
        "roles": roles,
        "warnings": warnings,
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


def _role_matrix_item(role: UserRole, active_users: int) -> dict:
    label_map = {
        UserRole.admin: "Admin",
        UserRole.manager: "Manager",
        UserRole.provider: "Provider",
        UserRole.ma: "MA / nurse",
        UserRole.front_desk: "Front desk",
    }
    return {
        "role": role.value,
        "label": label_map[role],
        "active_users": active_users,
        "can_view_patients": role in {
            UserRole.admin,
            UserRole.manager,
            UserRole.provider,
            UserRole.ma,
            UserRole.front_desk,
        },
        "can_manage_clinical": role in CLINICAL_WRITE_ROLES,
        "can_manage_front_office": role in FRONT_OFFICE_WRITE_ROLES,
        "can_manage_staff": role in MANAGER_ROLES,
        "can_manage_operations": role in MANAGER_ROLES,
        "can_manage_integrations": role in MANAGER_ROLES,
        "can_export_audit": role in MANAGER_ROLES,
        "mfa_required": role in PRIVILEGED_ROLES,
        "access_review_required": True,
        "summary": _role_summary(role),
    }


def _role_summary(role: UserRole) -> str:
    summaries = {
        UserRole.admin: "Full system administration, staff access, integrations, operations, and audit evidence.",
        UserRole.manager: "Clinic operations, staff review, launch evidence, integrations, and audit evidence without admin elevation.",
        UserRole.provider: "Clinical chart review, documents, medications, labs, encounters, and clinical task work.",
        UserRole.ma: "Clinical support workflows, document review, medication/lab prep, care plan, and checkout tasks.",
        UserRole.front_desk: "Scheduling, faxes, messages, patient access, outreach, and front-office task work.",
    }
    return summaries[role]


def _role_matrix_warnings(rows: list[User]) -> list[dict]:
    warnings: list[dict] = []
    privileged_mfa_gaps = [
        user
        for user in rows
        if user.is_active and user.role in PRIVILEGED_ROLES and not user.mfa_enabled
    ]
    if privileged_mfa_gaps:
        warnings.append({
            "key": "privileged_mfa_required",
            "label": "Privileged MFA required",
            "severity": "critical",
            "role": None,
            "detail": f"{len(privileged_mfa_gaps)} privileged active user(s) need MFA before production login.",
        })
    for role in UserRole:
        if not any(user.is_active and user.role == role for user in rows):
            warnings.append({
                "key": f"role_without_active_user:{role.value}",
                "label": "No active staff assigned",
                "severity": "warning",
                "role": role.value,
                "detail": f"No active {role.value.replace('_', ' ')} user is assigned.",
            })
    return warnings


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


def _recovery_item(user: User) -> dict:
    return {
        "user_id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role.value,
        "status": "temporary_expired"
        if temporary_password_is_expired(user)
        else "temporary_active",
        "temporary_password_expires_at": user.temporary_password_expires_at,
        "last_login_at": user.last_login_at,
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
