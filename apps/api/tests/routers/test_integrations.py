import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.integration_event_service import record_event
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_list_integration_events_is_scoped_to_user_organization(
    client: AsyncClient,
    admin_user,
    auth_headers,
    db: AsyncSession,
):
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-integration-admin@clinic.example.com",
        organization_id="other-org",
    )
    await record_event(
        db,
        admin_user,
        integration="fax_provider",
        direction="outbound",
        action="send_document",
        status="failed",
        entity_type="fax",
        entity_id="fax-1",
        error="Timeout",
    )
    await record_event(
        db,
        other_user,
        integration="portal",
        direction="outbound",
        action="send_message",
        status="failed",
        entity_type="message",
        entity_id="message-1",
    )

    res = await client.get("/api/integrations/events", headers=auth_headers)

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["data"][0]["integration"] == "fax_provider"
    assert body["data"][0]["organization_id"] == "default"


@pytest.mark.asyncio
async def test_retry_integration_event_marks_retrying(
    client: AsyncClient,
    admin_user,
    auth_headers,
    db: AsyncSession,
):
    event = await record_event(
        db,
        admin_user,
        integration="calendar",
        direction="outbound",
        action="create_event",
        status="failed",
    )

    res = await client.post(
        f"/api/integrations/events/{event.id}/retry",
        headers=auth_headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "retrying"
    assert body["attempts"] == 2


@pytest.mark.asyncio
async def test_provider_cannot_list_integration_events(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = await make_user(db, UserRole.provider, "integration-provider@example.com")

    res = await client.get("/api/integrations/events", headers=headers_for(provider))

    assert res.status_code == 403
