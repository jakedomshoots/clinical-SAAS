from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
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
async def test_assistant_context_returns_role_policy_and_safe_summary(client, auth_headers):
    response = await client.get(
        "/api/assistant/actions/context?path=/patients/00000000-0000-4000-8000-000000000101",
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["route"]["path"] == "/patients/00000000-0000-4000-8000-000000000101"
    assert body["route"]["label"] == "Patient chart"
    assert "clinical.create_follow_up_task" in body["allowed_tools"]
    assert body["work_summary"]["urgent_open_tasks"] >= 0
    assert "Require ConciergeOS confirmation before writes." in body["assistant_rules"]


@pytest.mark.asyncio
async def test_clicky_can_create_and_list_pending_proposals(client, auth_headers):
    proposal = {
        "proposal_type": "clinical.create_follow_up_task",
        "title": "Create follow-up task",
        "summary": "Follow up with the patient tomorrow morning.",
        "route_path": "/patients/00000000-0000-4000-8000-000000000101",
        "entity_type": "patient",
        "entity_id": "00000000-0000-4000-8000-000000000101",
        "payload": {
            "context": "Patient chart",
            "title": "Follow up tomorrow morning",
            "priority": "normal",
        },
        "confidence_reason": "The user asked for a follow-up task while viewing the patient chart.",
        "source": "clicky",
    }

    create_response = await client.post(
        "/api/assistant/actions/proposals",
        json=proposal,
        headers=auth_headers,
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["status"] == "pending"
    assert created["source"] == "clicky"

    list_response = await client.get("/api/assistant/actions/proposals", headers=auth_headers)
    assert list_response.status_code == 200
    assert any(item["id"] == created["id"] for item in list_response.json())


@pytest.mark.asyncio
async def test_assistant_proposal_can_be_dismissed(client, auth_headers):
    proposal_response = await client.post(
        "/api/assistant/actions/proposals",
        json={
            "proposal_type": "operations.review_blocker",
            "title": "Review launch blocker",
            "summary": "Review the readiness blocker in setup.",
            "route_path": "/setup",
            "entity_type": None,
            "entity_id": None,
            "payload": {"context": "Setup checklist"},
            "confidence_reason": "The user asked what blocks launch readiness.",
            "source": "clicky",
        },
        headers=auth_headers,
    )
    proposal_id = proposal_response.json()["id"]

    dismiss_response = await client.post(
        f"/api/assistant/actions/proposals/{proposal_id}/dismiss",
        headers=auth_headers,
    )

    assert dismiss_response.status_code == 200
    assert dismiss_response.json()["status"] == "dismissed"


@pytest.mark.asyncio
async def test_assistant_proposal_can_be_marked_confirmed(client, auth_headers):
    proposal_response = await client.post(
        "/api/assistant/actions/proposals",
        json={
            "proposal_type": "navigation.open_route",
            "title": "Open task queue",
            "summary": "Navigate to the task queue.",
            "route_path": "/tasks",
            "entity_type": None,
            "entity_id": None,
            "payload": {"context": "Task queue"},
            "confidence_reason": "The user asked where to find urgent work.",
            "source": "clicky",
        },
        headers=auth_headers,
    )
    proposal_id = proposal_response.json()["id"]

    confirm_response = await client.post(
        f"/api/assistant/actions/proposals/{proposal_id}/confirm",
        headers=auth_headers,
    )

    assert confirm_response.status_code == 200
    assert confirm_response.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_concierge_command_proposal_persists_and_can_be_listed(client, auth_headers):
    proposal = {
        "proposal_type": "navigation.open_route",
        "title": "Open fax center",
        "summary": "Navigate to inbound faxes.",
        "route_path": "/faxes",
        "entity_type": None,
        "entity_id": None,
        "payload": {"route_path": "/faxes"},
        "confidence_reason": "The typed command asked to open faxes.",
        "source": "concierge_command",
        "input_mode": "typed",
        "original_command": "open faxes",
    }

    create_response = await client.post(
        "/api/assistant/actions/proposals",
        json=proposal,
        headers=auth_headers,
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["source"] == "concierge_command"
    assert created["input_mode"] == "typed"
    assert created["original_command"] == "open faxes"

    list_response = await client.get("/api/assistant/actions/proposals", headers=auth_headers)
    assert list_response.status_code == 200
    assert any(item["id"] == created["id"] for item in list_response.json())


@pytest.mark.asyncio
async def test_expired_assistant_proposal_cannot_be_confirmed(client, auth_headers):
    proposal_response = await client.post(
        "/api/assistant/actions/proposals",
        json={
            "proposal_type": "navigation.open_route",
            "title": "Open task queue",
            "summary": "Navigate to the task queue.",
            "route_path": "/tasks",
            "entity_type": None,
            "entity_id": None,
            "payload": {"route_path": "/tasks"},
            "confidence_reason": "The command asked to open tasks.",
            "source": "concierge_command",
            "input_mode": "typed",
            "original_command": "open tasks",
            "expires_at": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
        },
        headers=auth_headers,
    )
    proposal_id = proposal_response.json()["id"]

    confirm_response = await client.post(
        f"/api/assistant/actions/proposals/{proposal_id}/confirm",
        headers=auth_headers,
    )

    assert confirm_response.status_code == 409
    assert confirm_response.json()["detail"] == "Proposal has expired"


@pytest.mark.asyncio
async def test_typed_command_creates_follow_up_task_proposal(client, auth_headers):
    patient_id = await create_patient(client, auth_headers)

    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "create follow up task to call tomorrow",
            "input_mode": "typed",
            "route_path": f"/patients/{patient_id}",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["result_type"] == "proposal"
    assert body["proposal"]["proposal_type"] == "clinical.create_follow_up_task"
    assert body["proposal"]["source"] == "concierge_command"
    assert body["proposal"]["entity_id"] == patient_id
    assert body["proposal"]["payload"]["patient_id"] == patient_id


@pytest.mark.asyncio
async def test_voice_command_creates_navigation_proposal(client, auth_headers):
    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "open the billing queue",
            "input_mode": "voice",
            "route_path": "/",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["result_type"] == "proposal"
    assert body["proposal"]["proposal_type"] == "navigation.open_route"
    assert body["proposal"]["route_path"] == "/billing"
    assert body["proposal"]["input_mode"] == "voice"


@pytest.mark.asyncio
async def test_command_can_return_current_view_summary(client, auth_headers):
    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "summarize this view",
            "input_mode": "typed",
            "route_path": "/faxes",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["result_type"] == "answer"
    assert "Fax center" in body["message"]


@pytest.mark.asyncio
async def test_command_creates_portal_reply_proposal(client, auth_headers, db: AsyncSession):
    recipient = await make_user(db, UserRole.provider, "assistant-command-recipient@example.com")

    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "draft portal reply about the lab result",
            "input_mode": "typed",
            "route_path": "/messaging",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["result_type"] == "proposal"
    assert body["proposal"]["proposal_type"] == "clinical.draft_portal_reply"
    assert body["proposal"]["payload"]["recipient_id"] == recipient.id
    assert body["proposal"]["payload"]["subject"] == "Care team follow-up"
    assert "lab result" in body["proposal"]["payload"]["body"].lower()


@pytest.mark.asyncio
async def test_command_creates_fax_match_proposal(client, auth_headers, db: AsyncSession):
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

    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "stage fax match to the first patient",
            "input_mode": "typed",
            "route_path": "/faxes",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["result_type"] == "proposal"
    assert body["proposal"]["proposal_type"] == "clinical.stage_fax_match"
    assert body["proposal"]["payload"]["fax_id"] == inbound.id
    assert body["proposal"]["payload"]["patient_id"] == patient_id


@pytest.mark.asyncio
async def test_command_creates_blocker_review_proposal(client, auth_headers):
    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "review launch blockers",
            "input_mode": "typed",
            "route_path": "/operations",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["result_type"] == "proposal"
    assert body["proposal"]["proposal_type"] == "operations.review_blocker"
    assert body["proposal"]["route_path"] == "/operations"
    assert body["proposal"]["payload"]["review_focus"] == "launch blockers"


@pytest.mark.asyncio
async def test_command_labels_blocker_review_for_active_workspace(client, auth_headers):
    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "review billing blockers",
            "input_mode": "typed",
            "route_path": "/billing",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["result_type"] == "proposal"
    assert body["proposal"]["title"] == "Review billing blockers"
    assert body["proposal"]["payload"]["review_focus"] == "billing blockers"


@pytest.mark.asyncio
async def test_command_blocks_fax_match_without_front_office_role(
    client,
    db: AsyncSession,
):
    provider = await make_user(db, UserRole.provider, "assistant-command-provider@example.com")

    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "stage fax match",
            "input_mode": "typed",
            "route_path": "/faxes",
        },
        headers=headers_for(provider),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["result_type"] == "blocked"
    assert "cannot stage fax match" in body["message"]


@pytest.mark.asyncio
async def test_command_returns_clarification_for_ambiguous_request(client, auth_headers):
    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "do the thing",
            "input_mode": "typed",
            "route_path": "/",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["result_type"] == "clarification"
    assert "Try asking" in body["message"]


@pytest.mark.asyncio
async def test_command_endpoint_rejects_disabled_native_ai_commands(
    client,
    auth_headers,
    monkeypatch,
):
    monkeypatch.setattr(settings, "native_ai_commands_enabled", False)

    response = await client.post(
        "/api/assistant/actions/commands",
        json={
            "command": "summarize this view",
            "input_mode": "typed",
            "route_path": "/",
        },
        headers=auth_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Native AI commands are disabled"


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
async def test_assistant_portal_reply_rejects_thread_for_different_recipient(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    thread_recipient = await make_user(
        db,
        UserRole.provider,
        "assistant-thread-recipient@clinic.example.com",
    )
    other_recipient = await make_user(
        db,
        UserRole.provider,
        "assistant-other-recipient@clinic.example.com",
    )
    thread = await client.post(
        "/api/messages",
        json={
            "recipient_id": thread_recipient.id,
            "subject": "Existing thread",
            "body": "This belongs to the first recipient.",
        },
        headers=auth_headers,
    )

    res = await client.post(
        "/api/assistant/actions/portal-reply-draft",
        json={
            "context": "Portal inbox",
            "recipient_id": other_recipient.id,
            "thread_id": thread.json()["thread_id"],
            "subject": "Cross-thread draft",
            "body": "This should not attach to the other recipient thread.",
        },
        headers=auth_headers,
    )

    assert res.status_code == 404


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
        event["event_type"] == "assistant.fax_match_staged" for event in audit.json()["data"]
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
