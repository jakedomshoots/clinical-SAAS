from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.user import UserRole
from app.services.auth_service import authenticate_user
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_list_users_returns_active_org_staff(
    client: AsyncClient,
    auth_headers,
    admin_user,
    db: AsyncSession,
):
    await make_user(db, UserRole.ma, "ma-directory@clinic.example.com")
    await make_user(
        db,
        UserRole.provider,
        "other-org-directory@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get("/api/users", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    emails = {item["email"] for item in data["data"]}
    assert admin_user.email in emails
    assert "ma-directory@clinic.example.com" in emails
    assert "other-org-directory@clinic.example.com" not in emails


@pytest.mark.asyncio
async def test_list_users_is_scoped_to_requesting_user_org(
    client: AsyncClient,
    db: AsyncSession,
):
    other_user = await make_user(
        db,
        UserRole.manager,
        "other-org-users-manager@clinic.example.com",
        organization_id="other-org",
    )
    await make_user(db, UserRole.ma, "default-org-hidden-user@clinic.example.com")

    res = await client.get("/api/users", headers=headers_for(other_user))

    assert res.status_code == 200
    emails = {item["email"] for item in res.json()["data"]}
    assert "other-org-users-manager@clinic.example.com" in emails
    assert "default-org-hidden-user@clinic.example.com" not in emails


@pytest.mark.asyncio
async def test_manager_can_update_staff_status_and_role(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-update-user@clinic.example.com")
    staff = await make_user(db, UserRole.ma, "staff-update-user@clinic.example.com")

    res = await client.patch(
        f"/api/users/{staff.id}",
        json={"display_name": "Front Desk Lead", "role": "front_desk", "is_active": False},
        headers=headers_for(manager),
    )

    assert res.status_code == 200
    data = res.json()
    assert data["display_name"] == "Front Desk Lead"
    assert data["role"] == "front_desk"
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_manager_can_update_staff_mfa_status(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-mfa-user@clinic.example.com")
    staff = await make_user(db, UserRole.ma, "staff-mfa-user@clinic.example.com")

    res = await client.patch(
        f"/api/users/{staff.id}",
        json={"mfa_enabled": True},
        headers=headers_for(manager),
    )

    assert res.status_code == 200
    assert res.json()["mfa_enabled"] is True


@pytest.mark.asyncio
async def test_admin_can_issue_temporary_password_reset_and_recovery_summary(
    client: AsyncClient,
    auth_headers,
    admin_user,
    db: AsyncSession,
):
    staff = await make_user(db, UserRole.provider, "provider-reset@clinic.example.com")
    old_staff_headers = headers_for(staff)
    expired = await make_user(db, UserRole.ma, "ma-expired-reset@clinic.example.com")
    expired.password_must_change = True
    expired.temporary_password_expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(
        hours=1
    )
    await db.commit()

    reset = await client.post(f"/api/users/{staff.id}/password-reset", headers=auth_headers)

    assert reset.status_code == 200
    payload = reset.json()
    assert payload["user"]["password_must_change"] is True
    assert payload["temporary_password"]
    assert payload["temporary_password_expires_at"] is not None
    assert await authenticate_user(db, staff.email, payload["temporary_password"]) is not None
    old_session = await client.get("/api/auth/me", headers=old_staff_headers)
    assert old_session.status_code == 401

    summary = await client.get("/api/users/recovery-summary", headers=auth_headers)
    assert summary.status_code == 200
    data = summary.json()
    assert data["temporary_password_count"] >= 2
    assert data["expired_temporary_password_count"] >= 1
    by_email = {item["email"]: item for item in data["data"]}
    assert by_email["provider-reset@clinic.example.com"]["status"] == "temporary_active"
    assert by_email["ma-expired-reset@clinic.example.com"]["status"] == "temporary_expired"

    audit = (
        await db.execute(
            select(AuditLog).where(
                AuditLog.event_type == "user.password_reset_issued",
                AuditLog.entity_id == staff.id,
            )
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert audit.actor_id == admin_user.id


@pytest.mark.asyncio
async def test_manager_cannot_issue_admin_password_reset(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-reset-admin@clinic.example.com")
    admin = await make_user(db, UserRole.admin, "admin-reset-protected@clinic.example.com")

    res = await client.post(
        f"/api/users/{admin.id}/password-reset",
        headers=headers_for(manager),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_manager_cannot_grant_admin_role(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-grant-admin@clinic.example.com")
    staff = await make_user(db, UserRole.ma, "staff-grant-admin@clinic.example.com")

    res = await client.patch(
        f"/api/users/{staff.id}",
        json={"role": "admin"},
        headers=headers_for(manager),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_manager_cannot_modify_admin_user(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-edit-admin@clinic.example.com")
    admin = await make_user(db, UserRole.admin, "admin-protected-user@clinic.example.com")

    res = await client.patch(
        f"/api/users/{admin.id}",
        json={"display_name": "Downgraded Admin", "role": "provider"},
        headers=headers_for(manager),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_manager_cannot_change_own_role_or_active_status(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-self-edit@clinic.example.com")

    res = await client.patch(
        f"/api/users/{manager.id}",
        json={"role": "front_desk", "is_active": False},
        headers=headers_for(manager),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_access_review_summary_flags_privileged_mfa_and_never_reviewed(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await make_user(db, UserRole.manager, "manager-review-gap@clinic.example.com")
    await make_user(db, UserRole.provider, "provider-review-gap@clinic.example.com")

    res = await client.get("/api/users/access-review", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    assert data["due_count"] >= 2
    assert data["privileged_without_mfa_count"] >= 1
    by_email = {item["user"]["email"]: item for item in data["data"]}
    assert "privileged_mfa_missing" in by_email["manager-review-gap@clinic.example.com"]["findings"]
    assert "never_reviewed" in by_email["provider-review-gap@clinic.example.com"]["findings"]


@pytest.mark.asyncio
async def test_mark_access_reviewed_sets_review_fields_and_logs_audit(
    client: AsyncClient,
    auth_headers,
    admin_user,
    db: AsyncSession,
):
    staff = await make_user(db, UserRole.manager, "manager-reviewed-user@clinic.example.com")

    res = await client.post(
        f"/api/users/{staff.id}/access-review",
        json={"note": "Quarterly access review complete.", "mfa_enabled": True},
        headers=auth_headers,
    )

    assert res.status_code == 200
    data = res.json()
    assert data["mfa_enabled"] is True
    assert data["access_reviewed_at"] is not None
    assert data["access_reviewed_by_id"] == admin_user.id
    assert data["access_review_note"] == "Quarterly access review complete."

    audit = (
        await db.execute(
            select(AuditLog).where(
                AuditLog.event_type == "user.access_reviewed",
                AuditLog.entity_id == staff.id,
            )
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert audit.actor_id == admin_user.id


@pytest.mark.asyncio
async def test_manager_cannot_review_admin_access(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-review-admin@clinic.example.com")
    admin = await make_user(db, UserRole.admin, "admin-review-protected@clinic.example.com")

    res = await client.post(
        f"/api/users/{admin.id}/access-review",
        json={"note": "Attempted review"},
        headers=headers_for(manager),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_provider_cannot_open_access_review(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = await make_user(
        db, UserRole.provider, "provider-review-forbidden@clinic.example.com"
    )

    res = await client.get("/api/users/access-review", headers=headers_for(provider))

    assert res.status_code == 403
