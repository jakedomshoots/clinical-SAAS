import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_fax_webhook_records_integration_event(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/webhooks/fax",
        json={
            "organization_id": "default",
            "event_id": "fax-event-1",
            "action": "status.received",
            "entity_type": "fax",
            "entity_id": "fax-123",
            "payload": {"status": "received"},
        },
    )

    assert res.status_code == 202
    body = res.json()
    assert body["integration"] == "fax_provider"
    assert body["status"] == "succeeded"

    listed = await client.get("/api/integrations/events", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["idempotency_key"] == "fax-event-1"


@pytest.mark.asyncio
async def test_webhook_idempotency_returns_duplicate(client: AsyncClient):
    payload = {
        "organization_id": "default",
        "event_id": "portal-event-1",
        "action": "message.received",
        "entity_type": "message",
        "entity_id": "message-123",
        "payload": {"subject": "Hello"},
    }

    first = await client.post("/api/webhooks/portal", json=payload)
    second = await client.post("/api/webhooks/portal", json=payload)

    assert first.status_code == 202
    assert second.status_code == 202
    assert second.json()["duplicate"] is True
    assert second.json()["id"] == first.json()["id"]


@pytest.mark.asyncio
async def test_webhook_secret_is_enforced(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", "secret")

    denied = await client.post(
        "/api/webhooks/calendar",
        json={"action": "event.updated", "event_id": "calendar-event-1"},
    )
    allowed = await client.post(
        "/api/webhooks/calendar",
        json={"action": "event.updated", "event_id": "calendar-event-1"},
        headers={"X-Concierge-Webhook-Secret": "secret"},
    )

    assert denied.status_code == 401
    assert allowed.status_code == 202
