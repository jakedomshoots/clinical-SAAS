import pytest
from httpx import AsyncClient

WEBHOOK_SECRET = "test-webhook-secret"
WEBHOOK_HEADERS = {"X-Concierge-Webhook-Secret": WEBHOOK_SECRET}


@pytest.mark.asyncio
async def test_fax_webhook_records_integration_event(client: AsyncClient, auth_headers, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)

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
        headers=WEBHOOK_HEADERS,
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
async def test_webhook_idempotency_returns_duplicate(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)
    payload = {
        "organization_id": "default",
        "event_id": "portal-event-1",
        "action": "message.received",
        "entity_type": "message",
        "entity_id": "message-123",
        "payload": {"subject": "Hello"},
    }

    first = await client.post("/api/webhooks/portal", json=payload, headers=WEBHOOK_HEADERS)
    second = await client.post("/api/webhooks/portal", json=payload, headers=WEBHOOK_HEADERS)

    assert first.status_code == 202
    assert second.status_code == 202
    assert second.json()["duplicate"] is True
    assert second.json()["id"] == first.json()["id"]


@pytest.mark.asyncio
async def test_webhook_secret_is_enforced(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)

    denied = await client.post(
        "/api/webhooks/calendar",
        json={"action": "event.updated", "event_id": "calendar-event-1"},
    )
    allowed = await client.post(
        "/api/webhooks/calendar",
        json={"action": "event.updated", "event_id": "calendar-event-1"},
        headers=WEBHOOK_HEADERS,
    )

    assert denied.status_code == 401
    assert allowed.status_code == 202


@pytest.mark.asyncio
async def test_webhook_requires_configured_secret(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", "")

    res = await client.post(
        "/api/webhooks/calendar",
        json={"action": "event.updated", "event_id": "calendar-event-2"},
    )

    assert res.status_code == 503


@pytest.mark.asyncio
async def test_communications_webhook_updates_task_delivery(
    client: AsyncClient,
    auth_headers,
    monkeypatch,
):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)

    patient_res = await client.post("/api/patients", json={
        "first_name": "Callback",
        "last_name": "Patient",
        "dob": "1990-01-01",
        "gender": "Unknown",
        "phone": "555-0100",
    }, headers=auth_headers)
    task_res = await client.post(
        "/api/tasks",
        json={"title": "Call patient", "patient_id": patient_res.json()["id"]},
        headers=auth_headers,
    )
    draft = await client.post(
        f"/api/tasks/{task_res.json()['id']}/patient-outreach",
        headers=auth_headers,
    )
    delivery = await client.post(
        f"/api/tasks/{task_res.json()['id']}/patient-outreach/deliver",
        json={"channel": "sms", "subject": draft.json()["subject"], "body": draft.json()["body"]},
        headers=auth_headers,
    )

    callback = await client.post(
        "/api/webhooks/communications",
        json={
            "organization_id": "default",
            "event_id": "delivery-1",
            "action": "delivery.updated",
            "entity_type": "task",
            "entity_id": task_res.json()["id"],
            "payload": {
                "provider_message_id": delivery.json()["provider_message_id"],
                "delivery_status": "delivered",
            },
        },
        headers=WEBHOOK_HEADERS,
    )

    assert callback.status_code == 202
    assert callback.json()["applied"] is True
    listed = await client.get(f"/api/tasks?patient_id={patient_res.json()['id']}", headers=auth_headers)
    assert listed.json()["data"][0]["delivery_status"] == "delivered"
    assert listed.json()["data"][0]["delivered_at"] is not None
