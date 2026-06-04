import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.auth_service import create_access_token, hash_password


@pytest.mark.asyncio
async def test_list_audit_events(client: AsyncClient, auth_headers):
    await client.post("/api/tasks", json={"title": "Audit visible task"}, headers=auth_headers)

    res = await client.get("/api/audit", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["data"][0]["event_type"] == "task.created"
    assert data["data"][0]["entity_type"] == "task"


@pytest.mark.asyncio
async def test_filter_audit_events_by_entity_type(client: AsyncClient, auth_headers):
    await client.post("/api/tasks", json={"title": "Filtered audit task"}, headers=auth_headers)

    res = await client.get("/api/audit?entity_type=task", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["data"][0]["entity_type"] == "task"


@pytest.mark.asyncio
async def test_audit_events_require_admin_or_manager(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = User(
        email="audit-provider@clinic.example.com",
        hashed_password=hash_password("provider123!"),
        display_name="Audit Limited Provider",
        role=UserRole.provider,
        is_active=True,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    token = create_access_token(provider.id, provider.role.value)

    res = await client.get("/api/audit", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 403
