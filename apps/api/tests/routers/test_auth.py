import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.auth_service import create_access_token, hash_password
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user):
    res = await client.post("/api/auth/login", json={
        "email": "admin@clinic.example.com",
        "password": "admin123!",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@clinic.example.com"
    assert data["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, admin_user):
    res = await client.post("/api/auth/login", json={
        "email": "admin@clinic.example.com",
        "password": "wrongpassword!",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    res = await client.post("/api/auth/login", json={
        "email": "nobody@clinic.example.com",
        "password": "whatever123!",
    })
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
    res = await client.post("/api/auth/register", json={
        "email": "provider@clinic.example.com",
        "password": "provider123!",
        "display_name": "Dr. Smith",
        "role": "provider",
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "provider@clinic.example.com"
    assert data["role"] == "provider"
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_requires_authentication(client: AsyncClient):
    res = await client.post("/api/auth/register", json={
        "email": "noauth@clinic.example.com",
        "password": "provider123!",
        "display_name": "No Auth",
        "role": "provider",
    })
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

    res = await client.post("/api/auth/register", json={
        "email": "blocked@clinic.example.com",
        "password": "provider123!",
        "display_name": "Blocked User",
        "role": "provider",
    }, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, admin_user, auth_headers):
    res = await client.post("/api/auth/register", json={
        "email": "admin@clinic.example.com",
        "password": "another123!!",
        "display_name": "Duplicate",
        "role": "provider",
    }, headers=auth_headers)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_register_requires_strong_password(client: AsyncClient, auth_headers):
    res = await client.post("/api/auth/register", json={
        "email": "weak@clinic.example.com",
        "password": "weak",
        "display_name": "Weak Password",
        "role": "provider",
    }, headers=auth_headers)
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
