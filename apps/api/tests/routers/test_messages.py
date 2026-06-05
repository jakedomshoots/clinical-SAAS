import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from tests.conftest import headers_for, make_user


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


@pytest.mark.asyncio
async def test_send_message_rejects_cross_org_recipient(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-message-recipient@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.post(
        "/api/messages",
        json={
            "recipient_id": other_user.id,
            "subject": "Cross org",
            "body": "This should not be sent.",
        },
        headers=auth_headers,
    )

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_message_read_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    admin_user,
    db: AsyncSession,
):
    created = await client.post(
        "/api/messages",
        json={
            "recipient_id": admin_user.id,
            "subject": "Org-scoped message",
            "body": "Keep this private.",
        },
        headers=auth_headers,
    )
    message_id = created.json()["id"]
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-message-reader@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get(
        f"/api/messages/{message_id}",
        headers=headers_for(other_user),
    )

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_message_threads_are_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    admin_user,
    db: AsyncSession,
):
    await client.post(
        "/api/messages",
        json={
            "recipient_id": admin_user.id,
            "subject": "Hidden thread",
            "body": "Only this org should see the thread.",
        },
        headers=auth_headers,
    )
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-message-thread@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get(
        "/api/messages/threads",
        headers=headers_for(other_user),
    )

    assert res.status_code == 200
    assert res.json()["total"] == 0
