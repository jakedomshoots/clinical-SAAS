from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.audit import AuditLog
from app.models.user import User, UserRole
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    hash_password,
    seed_admin,
)
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user, db: AsyncSession):
    res = await client.post(
        "/api/auth/login",
        json={
            "email": "admin@clinic.example.com",
            "password": "admin123!",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@clinic.example.com"
    assert data["user"]["role"] == "admin"
    refreshed = (await db.execute(select(User).where(User.id == admin_user.id))).scalar_one()
    assert refreshed.last_login_at is not None


@pytest.mark.asyncio
async def test_production_login_requires_external_mfa_handoff_for_staff(
    client: AsyncClient,
    admin_user,
    db: AsyncSession,
    monkeypatch,
):
    monkeypatch.setattr(settings, "app_env", "production")

    res = await client.post(
        "/api/auth/login",
        json={
            "email": "admin@clinic.example.com",
            "password": "admin123!",
        },
    )

    assert res.status_code == 403
    assert res.json()["detail"] == "Production staff login requires external MFA provider handoff"
    audit = (
        await db.execute(
            select(AuditLog).where(
                AuditLog.event_type == "auth.login_blocked",
                AuditLog.entity_id == admin_user.id,
            )
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert audit.payload["reason"] == "external_mfa_required"


@pytest.mark.asyncio
async def test_production_login_blocks_local_token_even_when_staff_has_local_mfa_flag(
    client: AsyncClient,
    admin_user,
    db: AsyncSession,
    monkeypatch,
):
    monkeypatch.setattr(settings, "app_env", "production")
    admin_user.mfa_enabled = True
    await db.commit()

    res = await client.post(
        "/api/auth/login",
        json={
            "email": "admin@clinic.example.com",
            "password": "admin123!",
        },
    )

    assert res.status_code == 403
    audit = (
        await db.execute(
            select(AuditLog).where(
                AuditLog.event_type == "auth.login_blocked",
                AuditLog.entity_id == admin_user.id,
            )
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert audit.payload["reason"] == "external_mfa_required"


@pytest.mark.asyncio
async def test_patient_portal_login_returns_patient_scoped_token(client: AsyncClient, auth_headers):
    patient = await client.post(
        "/api/patients",
        json={
            "first_name": "Portal",
            "last_name": "Patient",
            "dob": "1991-02-03",
            "gender": "Unknown",
            "email": "portal.patient@example.com",
        },
        headers=auth_headers,
    )
    assert patient.status_code == 201
    issued = await client.post(
        f"/api/patients/{patient.json()['id']}/portal-access-code",
        headers=auth_headers,
    )
    assert issued.status_code == 200

    login = await client.post(
        "/api/portal/auth/login",
        json={
            "email": "portal.patient@example.com",
            "dob": "1991-02-03",
            "access_code": issued.json()["access_code"],
        },
    )
    assert login.status_code == 200
    assert login.json()["patient"]["id"] == patient.json()["id"]

    me = await client.get(
        "/api/portal/auth/me",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["id"] == patient.json()["id"]

    intake = await client.post(
        "/api/portal/auth/intake",
        json={"request_type": "intake_form", "submitted_payload": {"reason": "Portal update"}},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert intake.status_code == 201
    assert intake.json()["patient_id"] == patient.json()["id"]

    prepared = await client.post(
        "/api/portal/auth/documents/upload",
        json={"filename": "portal-note.pdf", "content_type": "application/pdf"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    confirmed = await client.post(
        "/api/portal/auth/documents/upload/confirm",
        json={
            "title": "Portal note",
            "source": "Patient Portal",
            "document_type": "Outside record",
            "file_url": prepared.json()["file_url"],
            "filename": "portal-note.pdf",
            "content_type": "application/pdf",
            "checksum": "portal-test-checksum",
            "upload_token": prepared.json()["upload_token"],
        },
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert prepared.status_code == 200
    assert confirmed.status_code == 201
    assert confirmed.json()["patient_id"] == patient.json()["id"]


@pytest.mark.asyncio
async def test_patient_portal_login_rejects_email_and_dob_without_valid_code(
    client: AsyncClient,
    auth_headers,
):
    patient = await client.post(
        "/api/patients",
        json={
            "first_name": "Portal",
            "last_name": "Protected",
            "dob": "1991-02-03",
            "gender": "Unknown",
            "email": "portal.protected@example.com",
        },
        headers=auth_headers,
    )
    assert patient.status_code == 201

    missing_code = await client.post(
        "/api/portal/auth/login",
        json={"email": "portal.protected@example.com", "dob": "1991-02-03"},
    )
    wrong_code = await client.post(
        "/api/portal/auth/login",
        json={
            "email": "portal.protected@example.com",
            "dob": "1991-02-03",
            "access_code": "wrong-code-123",
        },
    )

    assert missing_code.status_code == 422
    assert wrong_code.status_code == 401


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, admin_user):
    res = await client.post(
        "/api/auth/login",
        json={
            "email": "admin@clinic.example.com",
            "password": "wrongpassword!",
        },
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    res = await client.post(
        "/api/auth/login",
        json={
            "email": "nobody@clinic.example.com",
            "password": "whatever123!",
        },
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient, auth_headers):
    res = await client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "admin@clinic.example.com"
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_me_without_token(client: AsyncClient):
    res = await client.get("/api/auth/me")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_register_new_user(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/auth/register",
        json={
            "email": "provider@clinic.example.com",
            "password": "provider123!",
            "display_name": "Dr. Smith",
            "role": "provider",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "provider@clinic.example.com"
    assert data["role"] == "provider"
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_registered_user_must_rotate_temporary_password_before_login(
    client: AsyncClient,
    auth_headers,
):
    created = await client.post(
        "/api/auth/register",
        json={
            "email": "rotate-provider@clinic.example.com",
            "password": "provider123!",
            "display_name": "Rotate Provider",
            "role": "provider",
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    assert created.json()["password_must_change"] is True
    assert created.json()["temporary_password_expires_at"] is not None

    blocked_login = await client.post(
        "/api/auth/login",
        json={
            "email": "rotate-provider@clinic.example.com",
            "password": "provider123!",
        },
    )
    assert blocked_login.status_code == 403
    assert blocked_login.json()["detail"] == "Password change required before login"

    rotated = await client.post(
        "/api/auth/complete-password-rotation",
        json={
            "email": "rotate-provider@clinic.example.com",
            "current_password": "provider123!",
            "new_password": "provider456!!",
        },
    )
    assert rotated.status_code == 200
    assert rotated.json()["user"]["password_must_change"] is False
    assert rotated.json()["user"]["temporary_password_expires_at"] is None
    assert rotated.json()["access_token"]

    old_login = await client.post(
        "/api/auth/login",
        json={
            "email": "rotate-provider@clinic.example.com",
            "password": "provider123!",
        },
    )
    normal_login = await client.post(
        "/api/auth/login",
        json={
            "email": "rotate-provider@clinic.example.com",
            "password": "provider456!!",
        },
    )
    assert old_login.status_code == 401
    assert normal_login.status_code == 200


@pytest.mark.asyncio
async def test_expired_temporary_password_cannot_be_rotated(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    created = await client.post(
        "/api/auth/register",
        json={
            "email": "expired-temp@clinic.example.com",
            "password": "provider123!",
            "display_name": "Expired Temp",
            "role": "provider",
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    user = (
        await db.execute(select(User).where(User.email == "expired-temp@clinic.example.com"))
    ).scalar_one()
    user.temporary_password_expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(
        minutes=1
    )
    await db.commit()

    rotated = await client.post(
        "/api/auth/complete-password-rotation",
        json={
            "email": "expired-temp@clinic.example.com",
            "current_password": "provider123!",
            "new_password": "provider456!!",
        },
    )

    assert rotated.status_code == 403
    assert rotated.json()["detail"] == "Temporary password expired"


@pytest.mark.asyncio
async def test_register_requires_authentication(client: AsyncClient):
    res = await client.post(
        "/api/auth/register",
        json={
            "email": "noauth@clinic.example.com",
            "password": "provider123!",
            "display_name": "No Auth",
            "role": "provider",
        },
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_register_requires_admin_or_manager(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = User(
        email="limited-provider@clinic.example.com",
        hashed_password=hash_password("provider123!"),
        display_name="Limited Provider",
        role=UserRole.provider,
        is_active=True,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    token = create_access_token(provider.id, provider.role.value)

    res = await client.post(
        "/api/auth/register",
        json={
            "email": "blocked@clinic.example.com",
            "password": "provider123!",
            "display_name": "Blocked User",
            "role": "provider",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, admin_user, auth_headers):
    res = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@clinic.example.com",
            "password": "another123!!",
            "display_name": "Duplicate",
            "role": "provider",
        },
        headers=auth_headers,
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_register_requires_strong_password(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/auth/register",
        json={
            "email": "weak@clinic.example.com",
            "password": "weak",
            "display_name": "Weak Password",
            "role": "provider",
        },
        headers=auth_headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_manager_can_register_user_in_own_organization(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(
        db,
        UserRole.manager,
        "manager-register-own-org@clinic.example.com",
        organization_id="manager-org",
    )

    res = await client.post(
        "/api/auth/register",
        json={
            "email": "new-user-own-org@clinic.example.com",
            "password": "provider123!",
            "display_name": "Own Org User",
            "role": "provider",
        },
        headers=headers_for(manager),
    )

    assert res.status_code == 201
    assert res.json()["organization_id"] == "manager-org"


@pytest.mark.asyncio
async def test_manager_cannot_register_user_in_other_organization(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(
        db,
        UserRole.manager,
        "manager-register-other-org@clinic.example.com",
        organization_id="manager-org",
    )

    res = await client.post(
        "/api/auth/register",
        json={
            "email": "new-user-other-org@clinic.example.com",
            "password": "provider123!",
            "display_name": "Other Org User",
            "role": "provider",
            "organization_id": "other-org",
        },
        headers=headers_for(manager),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_register_user_in_other_organization(
    client: AsyncClient,
    auth_headers,
):
    res = await client.post(
        "/api/auth/register",
        json={
            "email": "new-admin-cross-org-user@clinic.example.com",
            "password": "provider123!",
            "display_name": "Cross Org User",
            "role": "provider",
            "organization_id": "other-org",
        },
        headers=auth_headers,
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_manager_cannot_register_admin(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(
        db,
        UserRole.manager,
        "manager-register-admin@clinic.example.com",
    )

    res = await client.post(
        "/api/auth/register",
        json={
            "email": "new-admin@clinic.example.com",
            "password": "provider123!",
            "display_name": "New Admin",
            "role": "admin",
        },
        headers=headers_for(manager),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_seed_admin_generates_temporary_password(db: AsyncSession):
    seeded = await seed_admin(db)

    assert seeded is not None
    admin, temporary_password = seeded
    assert temporary_password != "admin123!"
    assert await authenticate_user(db, admin.email, "admin123!") is None
    authenticated = await authenticate_user(db, admin.email, temporary_password)
    assert authenticated is not None
    assert authenticated.id == admin.id


@pytest.mark.asyncio
async def test_seed_endpoint_returns_temporary_password(client: AsyncClient):
    seeded = await client.post("/api/auth/seed")
    assert seeded.status_code == 201
    temporary_password = seeded.json()["temporary_password"]
    assert temporary_password
    assert temporary_password != "admin123!"

    default_login = await client.post(
        "/api/auth/login",
        json={"email": "admin@clinic.example.com", "password": "admin123!"},
    )
    temp_login = await client.post(
        "/api/auth/login",
        json={"email": "admin@clinic.example.com", "password": temporary_password},
    )

    assert default_login.status_code == 401
    assert temp_login.status_code == 403
    assert temp_login.json()["detail"] == "Password change required before login"


@pytest.mark.asyncio
async def test_seed_endpoint_can_be_disabled(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.auth.settings.allow_seed_endpoint", False)

    res = await client.post("/api/auth/seed")

    assert res.status_code == 404
