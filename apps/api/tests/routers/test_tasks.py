import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_task(client: AsyncClient, auth_headers, admin_user):
    res = await client.post("/api/tasks", json={
        "title": "Review lab results",
        "description": "Check CBC and CMP for patient",
        "priority": "high",
        "assigned_to_id": admin_user.id,
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Review lab results"
    assert data["status"] == "open"
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_list_tasks(client: AsyncClient, auth_headers, admin_user):
    await client.post("/api/tasks", json={"title": "Task A", "priority": "normal"}, headers=auth_headers)
    await client.post("/api/tasks", json={"title": "Task B", "priority": "urgent"}, headers=auth_headers)

    res = await client.get("/api/tasks", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_filter_tasks_by_status(client: AsyncClient, auth_headers, admin_user):
    res = await client.post("/api/tasks", json={"title": "Open task"}, headers=auth_headers)
    task_id = res.json()["id"]
    await client.patch(f"/api/tasks/{task_id}", json={"status": "completed"}, headers=auth_headers)

    res = await client.get("/api/tasks?status=completed", headers=auth_headers)
    data = res.json()
    assert data["total"] == 1
    assert data["data"][0]["status"] == "completed"


@pytest.mark.asyncio
async def test_update_task_status(client: AsyncClient, auth_headers):
    res = await client.post("/api/tasks", json={"title": "In progress task"}, headers=auth_headers)
    task_id = res.json()["id"]

    res = await client.patch(f"/api/tasks/{task_id}", json={"status": "in_progress"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_complete_task(client: AsyncClient, auth_headers):
    res = await client.post("/api/tasks", json={"title": "To complete"}, headers=auth_headers)
    task_id = res.json()["id"]

    res = await client.patch(f"/api/tasks/{task_id}", json={"status": "completed"}, headers=auth_headers)
    assert res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_task_not_found(client: AsyncClient, auth_headers):
    res = await client.get("/api/tasks/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert res.status_code == 404
