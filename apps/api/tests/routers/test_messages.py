import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_send_message_creates_thread(client: AsyncClient, auth_headers, admin_user):
    res = await client.post(
        "/api/messages",
        json={
            "recipient_id": admin_user.id,
            "subject": "Care update",
            "body": "Please review this update.",
        },
        headers=auth_headers,
    )

    assert res.status_code == 201
    message = res.json()
    assert message["thread_id"] == message["id"]
    assert message["sender_id"] == admin_user.id

    threads = await client.get("/api/messages/threads", headers=auth_headers)
    assert threads.status_code == 200
    data = threads.json()
    assert data["total"] == 1
    assert data["data"][0]["subject"] == "Care update"


@pytest.mark.asyncio
async def test_mark_message_read(client: AsyncClient, auth_headers, admin_user):
    created = await client.post(
        "/api/messages",
        json={
            "recipient_id": admin_user.id,
            "subject": "Read receipt",
            "body": "Mark this message read.",
        },
        headers=auth_headers,
    )
    message_id = created.json()["id"]

    res = await client.post(f"/api/messages/{message_id}/read", headers=auth_headers)

    assert res.status_code == 200
    assert res.json()["is_read"] is True

    audit = await client.get("/api/audit?entity_type=message", headers=auth_headers)
    assert audit.status_code == 200
    event_types = {event["event_type"] for event in audit.json()["data"]}
    assert {"message.sent", "message.read"}.issubset(event_types)
