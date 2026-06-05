import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_create_task(client: AsyncClient, auth_headers, admin_user):
    res = await client.post(
        "/api/tasks",
        json={
            "title": "Review lab results",
            "description": "Check CBC and CMP for patient",
            "priority": "high",
            "assigned_to_id": admin_user.id,
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Review lab results"
    assert data["status"] == "open"
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_list_tasks(client: AsyncClient, auth_headers, admin_user):
    await client.post(
        "/api/tasks",
        json={"title": "Task A", "priority": "normal"},
        headers=auth_headers,
    )
    await client.post(
        "/api/tasks",
        json={"title": "Task B", "priority": "urgent"},
        headers=auth_headers,
    )

    res = await client.get("/api/tasks", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_filter_tasks_by_status(client: AsyncClient, auth_headers, admin_user):
    res = await client.post("/api/tasks", json={"title": "Open task"}, headers=auth_headers)
    task_id = res.json()["id"]
    await client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )

    res = await client.get("/api/tasks?status=completed", headers=auth_headers)
    data = res.json()
    assert data["total"] == 1
    assert data["data"][0]["status"] == "completed"


@pytest.mark.asyncio
async def test_update_task_status(client: AsyncClient, auth_headers):
    res = await client.post("/api/tasks", json={"title": "In progress task"}, headers=auth_headers)
    task_id = res.json()["id"]

    res = await client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_complete_task(client: AsyncClient, auth_headers):
    res = await client.post("/api/tasks", json={"title": "To complete"}, headers=auth_headers)
    task_id = res.json()["id"]

    res = await client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )
    assert res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_task_not_found(client: AsyncClient, auth_headers):
    res = await client.get(
        "/api/tasks/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_task_list_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await client.post("/api/tasks", json={"title": "Default org task"}, headers=auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get("/api/tasks", headers=headers_for(other_user))

    assert res.status_code == 200
    assert res.json()["total"] == 0


@pytest.mark.asyncio
async def test_task_get_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    create_res = await client.post(
        "/api/tasks",
        json={"title": "Hidden org task"},
        headers=auth_headers,
    )
    task_id = create_res.json()["id"]
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-get-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get(f"/api/tasks/{task_id}", headers=headers_for(other_user))

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_task_update_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    create_res = await client.post(
        "/api/tasks",
        json={"title": "Protected org task"},
        headers=auth_headers,
    )
    task_id = create_res.json()["id"]
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-update-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "completed"},
        headers=headers_for(other_user),
    )

    assert res.status_code == 404
