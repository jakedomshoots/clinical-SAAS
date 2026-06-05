from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fax import Fax, FaxDirection, FaxStatus
from app.models.user import UserRole
from tests.conftest import headers_for, make_user


async def create_patient(client: AsyncClient, auth_headers) -> str:
    res = await client.post(
        "/api/patients",
        json={
            "first_name": "Assistant",
            "last_name": "Patient",
            "dob": date(1980, 1, 1).isoformat(),
            "gender": "Unknown",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_assistant_creates_follow_up_task(client: AsyncClient, auth_headers):
    patient_id = await create_patient(client, auth_headers)

    res = await client.post(
        "/api/assistant/actions/follow-up-task",
        json={"context": "Patient chart", "patient_id": patient_id},
        headers=auth_headers,
    )

    assert res.status_code == 201
    task = res.json()
    assert task["patient_id"] == patient_id
    assert task["priority"] == "high"
    assert "Assistant staged this from" in task["description"]

    audit = await client.get("/api/audit?entity_type=task", headers=auth_headers)
    assert audit.status_code == 200
    assert any(event["event_type"] == "assistant.task_created" for event in audit.json()["data"])


@pytest.mark.asyncio
async def test_assistant_drafts_portal_reply(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    recipient = await make_user(db, UserRole.provider, "assistant-recipient@clinic.example.com")

    res = await client.post(
        "/api/assistant/actions/portal-reply-draft",
        json={
            "context": "Portal inbox",
            "recipient_id": recipient.id,
            "subject": "Care team follow-up",
            "body": "Your care team is reviewing this and will follow up.",
        },
        headers=auth_headers,
    )

    assert res.status_code == 201
    message = res.json()
    assert message["recipient_id"] == recipient.id
    assert message["thread_id"] == message["id"]
    assert message["is_read"] is True

    audit = await client.get("/api/audit?entity_type=message", headers=auth_headers)
    assert audit.status_code == 200
    assert any(event["event_type"] == "assistant.message_drafted" for event in audit.json()["data"])


@pytest.mark.asyncio
async def test_assistant_stages_fax_match(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    patient_id = await create_patient(client, auth_headers)
    inbound = Fax(
        direction=FaxDirection.inbound,
        status=FaxStatus.received,
        from_number="+13125550111",
        to_number="+13125550999",
        pages=3,
        ocr_text="Referral packet awaiting chart match.",
    )
    db.add(inbound)
    await db.commit()
    await db.refresh(inbound)

    res = await client.post(
        "/api/assistant/actions/fax-match",
        json={"context": "Fax center", "fax_id": inbound.id, "patient_id": patient_id},
        headers=auth_headers,
    )

    assert res.status_code == 200
    fax = res.json()
    assert fax["patient_id"] == patient_id
    assert fax["matched_by"] == "assistant suggested, user confirmed"

    audit = await client.get("/api/audit?entity_type=fax", headers=auth_headers)
    assert audit.status_code == 200
    assert any(
        event["event_type"] == "assistant.fax_match_staged"
        for event in audit.json()["data"]
    )


@pytest.mark.asyncio
async def test_assistant_fax_match_requires_front_office_role(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = await make_user(db, UserRole.provider, "assistant-provider@clinic.example.com")

    res = await client.post(
        "/api/assistant/actions/fax-match",
        json={
            "context": "Fax center",
            "fax_id": "00000000-0000-4000-8000-000000000001",
            "patient_id": "00000000-0000-4000-8000-000000000002",
        },
        headers=headers_for(provider),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_assistant_policy_lists_tools_for_provider(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = await make_user(db, UserRole.provider, "assistant-policy-provider@example.com")

    res = await client.get(
        "/api/assistant/actions/policy",
        headers=headers_for(provider),
    )

    assert res.status_code == 200
    tools = set(res.json()["allowed_tools"])
    assert "clinical.create_follow_up_task" in tools
    assert "clinical.draft_portal_reply" in tools
    assert "clinical.stage_fax_match" not in tools


@pytest.mark.asyncio
async def test_assistant_policy_lists_tools_for_front_desk(
    client: AsyncClient,
    db: AsyncSession,
):
    front_desk = await make_user(
        db,
        UserRole.front_desk,
        "assistant-policy-front-desk@example.com",
    )

    res = await client.get(
        "/api/assistant/actions/policy",
        headers=headers_for(front_desk),
    )

    assert res.status_code == 200
    assert res.json()["allowed_tools"] == ["clinical.stage_fax_match"]
