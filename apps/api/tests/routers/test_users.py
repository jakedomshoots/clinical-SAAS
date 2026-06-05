import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
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
