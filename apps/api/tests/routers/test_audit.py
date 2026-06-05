import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.auth_service import create_access_token, hash_password
from tests.conftest import headers_for, make_user


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
async def test_export_audit_events_csv(client: AsyncClient, auth_headers):
    await client.post("/api/tasks", json={"title": "Exported audit task"}, headers=auth_headers)

    res = await client.get("/api/audit/export?entity_type=task", headers=auth_headers)

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    assert "organization_id,created_at,actor_id,event_type,entity_type,entity_id" in res.text
    assert "task.created,task" in res.text


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


@pytest.mark.asyncio
async def test_export_audit_events_requires_admin_or_manager(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = User(
        email="audit-export-provider@clinic.example.com",
        hashed_password=hash_password("provider123!"),
        display_name="Audit Export Limited Provider",
        role=UserRole.provider,
        is_active=True,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    token = create_access_token(provider.id, provider.role.value)

    res = await client.get("/api/audit/export", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_audit_events_are_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await client.post("/api/tasks", json={"title": "Default audit task"}, headers=auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-audit-admin@clinic.example.com",
        organization_id="other-org",
    )
    await client.post(
        "/api/tasks",
        json={"title": "Other audit task"},
        headers=headers_for(other_user),
    )

    default_res = await client.get("/api/audit?entity_type=task", headers=auth_headers)
    other_res = await client.get(
        "/api/audit?entity_type=task",
        headers=headers_for(other_user),
    )

    assert default_res.status_code == 200
    assert default_res.json()["total"] == 1
    assert default_res.json()["data"][0]["organization_id"] == "default"
    assert other_res.status_code == 200
    assert other_res.json()["total"] == 1
    assert other_res.json()["data"][0]["organization_id"] == "other-org"


@pytest.mark.asyncio
async def test_audit_export_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await client.post("/api/tasks", json={"title": "Default export task"}, headers=auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-audit-export-admin@clinic.example.com",
        organization_id="other-org",
    )
    await client.post(
        "/api/tasks",
        json={"title": "Other export task"},
        headers=headers_for(other_user),
    )

    res = await client.get("/api/audit/export?entity_type=task", headers=auth_headers)

    assert res.status_code == 200
    assert ",default," in res.text
    assert ",other-org," not in res.text
