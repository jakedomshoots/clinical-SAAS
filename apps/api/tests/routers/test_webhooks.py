import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

WEBHOOK_SECRET = "test-webhook-secret"


def webhook_body(payload: dict) -> bytes:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")


def webhook_headers(body: bytes, timestamp: datetime | None = None, signature: str | None = None) -> dict[str, str]:
    occurred_at = timestamp or datetime.now(UTC)
    timestamp_value = str(int(occurred_at.timestamp()))
    digest = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        timestamp_value.encode("utf-8") + b"." + body,
        hashlib.sha256,
    ).hexdigest()
    return {
        "X-Concierge-Webhook-Secret": WEBHOOK_SECRET,
        "X-Concierge-Webhook-Timestamp": timestamp_value,
        "X-Concierge-Webhook-Signature": signature or f"sha256={digest}",
    }


@pytest.mark.asyncio
async def test_fax_webhook_records_integration_event(client: AsyncClient, auth_headers, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)

    payload = {
        "organization_id": "default",
        "event_id": "fax-event-1",
        "action": "status.received",
        "entity_type": "fax",
        "entity_id": "fax-123",
        "payload": {"status": "received"},
    }
    body = webhook_body(payload)
    res = await client.post(
        "/api/webhooks/fax",
        content=body,
        headers={**webhook_headers(body), "Content-Type": "application/json"},
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

    body = webhook_body(payload)
    headers = {**webhook_headers(body), "Content-Type": "application/json"}
    first = await client.post("/api/webhooks/portal", content=body, headers=headers)
    second = await client.post("/api/webhooks/portal", content=body, headers=headers)

    assert first.status_code == 202
    assert second.status_code == 202
    assert second.json()["duplicate"] is True
    assert second.json()["id"] == first.json()["id"]


@pytest.mark.asyncio
async def test_webhook_rejects_unconfigured_organization(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_default_organization_id", "default")
    payload = {
        "organization_id": "other-org",
        "event_id": "portal-cross-org",
        "action": "message.received",
        "entity_type": "message",
        "entity_id": "message-123",
        "payload": {"subject": "Hello"},
    }

    body = webhook_body(payload)
    res = await client.post(
        "/api/webhooks/portal",
        content=body,
        headers={**webhook_headers(body), "Content-Type": "application/json"},
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_webhook_idempotency_is_scoped_by_integration(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)
    shared_event_id = "shared-vendor-event"
    fax_payload = {
        "organization_id": "default",
        "event_id": shared_event_id,
        "action": "status.received",
        "entity_type": "fax",
        "entity_id": "fax-123",
        "payload": {"status": "received"},
    }
    portal_payload = {
        "organization_id": "default",
        "event_id": shared_event_id,
        "action": "message.received",
        "entity_type": "message",
        "entity_id": "message-123",
        "payload": {"subject": "Hello"},
    }

    fax_body = webhook_body(fax_payload)
    portal_body = webhook_body(portal_payload)
    fax = await client.post(
        "/api/webhooks/fax",
        content=fax_body,
        headers={**webhook_headers(fax_body), "Content-Type": "application/json"},
    )
    portal = await client.post(
        "/api/webhooks/portal",
        content=portal_body,
        headers={**webhook_headers(portal_body), "Content-Type": "application/json"},
    )

    assert fax.status_code == 202
    assert portal.status_code == 202
    assert portal.json()["duplicate"] is False
    assert portal.json()["id"] != fax.json()["id"]


@pytest.mark.asyncio
async def test_webhook_secret_is_enforced(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)

    denied = await client.post(
        "/api/webhooks/calendar",
        json={"action": "event.updated", "event_id": "calendar-event-1"},
    )
    payload = {"action": "event.updated", "event_id": "calendar-event-1"}
    body = webhook_body(payload)
    allowed = await client.post(
        "/api/webhooks/calendar",
        content=body,
        headers={**webhook_headers(body), "Content-Type": "application/json"},
    )

    assert denied.status_code == 401
    assert allowed.status_code == 202


@pytest.mark.asyncio
async def test_webhook_requires_vendor_event_id(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)

    payload = {
        "organization_id": "default",
        "action": "status.received",
        "entity_type": "fax",
        "entity_id": "fax-123",
        "payload": {"status": "received"},
    }
    body = webhook_body(payload)
    res = await client.post(
        "/api/webhooks/fax",
        content=body,
        headers={**webhook_headers(body), "Content-Type": "application/json"},
    )

    assert res.status_code == 400
    assert "event_id" in res.json()["detail"]


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_payload_signature(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)
    payload = {"action": "patient.updated", "event_id": "ehr-event-signature"}
    body = webhook_body(payload)

    invalid = await client.post(
        "/api/webhooks/ehr",
        content=body,
        headers={
            **webhook_headers(body, signature="sha256=bad"),
            "Content-Type": "application/json",
        },
    )
    valid = await client.post(
        "/api/webhooks/ehr",
        content=body,
        headers={**webhook_headers(body), "Content-Type": "application/json"},
    )

    assert invalid.status_code == 401
    assert "signature" in invalid.json()["detail"].lower()
    assert valid.status_code == 202


@pytest.mark.asyncio
async def test_webhook_rejects_stale_timestamp(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.routers.webhooks.settings.webhook_shared_secret", WEBHOOK_SECRET)
    stale_payload = {"action": "patient.updated", "event_id": "ehr-event-stale"}
    stale_body = webhook_body(stale_payload)
    fresh_payload = {"action": "patient.updated", "event_id": "ehr-event-fresh"}
    fresh_body = webhook_body(fresh_payload)

    stale = await client.post(
        "/api/webhooks/ehr",
        content=stale_body,
        headers={
            **webhook_headers(stale_body, datetime.now(UTC) - timedelta(minutes=10)),
            "Content-Type": "application/json",
        },
    )
    fresh = await client.post(
        "/api/webhooks/ehr",
        content=fresh_body,
        headers={**webhook_headers(fresh_body), "Content-Type": "application/json"},
    )

    assert stale.status_code == 401
    assert "timestamp" in stale.json()["detail"].lower()
    assert fresh.status_code == 202


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
        "sms_consent": True,
        "preferred_contact_channel": "sms",
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

    payload = {
        "organization_id": "default",
        "event_id": "delivery-1",
        "action": "delivery.updated",
        "entity_type": "task",
        "entity_id": task_res.json()["id"],
        "payload": {
            "provider_message_id": delivery.json()["provider_message_id"],
            "delivery_status": "delivered",
        },
    }
    body = webhook_body(payload)
    callback = await client.post(
        "/api/webhooks/communications",
        content=body,
        headers={**webhook_headers(body), "Content-Type": "application/json"},
    )

    assert callback.status_code == 202
    assert callback.json()["applied"] is True
    listed = await client.get(f"/api/tasks?patient_id={patient_res.json()['id']}", headers=auth_headers)
    assert listed.json()["data"][0]["delivery_status"] == "delivered"
    assert listed.json()["data"][0]["delivered_at"] is not None
