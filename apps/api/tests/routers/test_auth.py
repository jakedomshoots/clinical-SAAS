import pytest
from httpx import AsyncClient


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
async def test_register_duplicate_email(client: AsyncClient, admin_user, auth_headers):
    res = await client.post("/api/auth/register", json={
        "email": "admin@clinic.example.com",
        "password": "another123!",
        "display_name": "Duplicate",
        "role": "provider",
    }, headers=auth_headers)
    assert res.status_code == 409
