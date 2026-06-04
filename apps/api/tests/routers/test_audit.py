import pytest
from httpx import AsyncClient


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
