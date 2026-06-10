from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_create_task(client: AsyncClient, auth_headers, admin_user):
    res = await client.post(
        "/api/tasks",
        json={
            "title": "Review lab results",
            "description": "Check CBC and CMP for patient",
            "priority": "high",
            "assigned_to_id": admin_user.id,
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Review lab results"
    assert data["status"] == "open"
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_list_tasks(client: AsyncClient, auth_headers, admin_user):
    await client.post(
        "/api/tasks",
        json={"title": "Task A", "priority": "normal"},
        headers=auth_headers,
    )
    await client.post(
        "/api/tasks",
        json={"title": "Task B", "priority": "urgent"},
        headers=auth_headers,
    )

    res = await client.get("/api/tasks", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_task_work_queue_summarizes_daily_operations(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    nurse = await make_user(db, UserRole.ma, "task-queue-ma@clinic.example.com")
    provider = await make_user(db, UserRole.provider, "task-queue-provider@clinic.example.com")
    now = datetime.now(UTC)
    overdue = (now - timedelta(days=1)).isoformat()
    due_today = now.replace(hour=23, minute=59, second=0, microsecond=0).isoformat()
    tomorrow = (now + timedelta(days=1)).isoformat()
    await client.post(
        "/api/tasks",
        json={
            "title": "Review urgent outside lab",
            "priority": "urgent",
            "due_date": overdue,
            "assigned_to_id": provider.id,
            "source_type": "document_processing",
        },
        headers=auth_headers,
    )
    await client.post(
        "/api/tasks",
        json={
            "title": "Call patient after checkout",
            "priority": "high",
            "due_date": due_today,
            "assigned_to_id": nurse.id,
            "source_type": "checkout_handoff:care_plan",
        },
        headers=auth_headers,
    )
    await client.post(
        "/api/tasks",
        json={
            "title": "Unassigned insurance follow-up",
            "priority": "normal",
            "due_date": tomorrow,
            "source_type": "billing",
        },
        headers=auth_headers,
    )
    completed = await client.post(
        "/api/tasks",
        json={"title": "Completed task", "priority": "urgent", "due_date": overdue},
        headers=auth_headers,
    )
    await client.patch(
        f"/api/tasks/{completed.json()['id']}",
        json={"status": "completed"},
        headers=auth_headers,
    )
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-work-queue@clinic.example.com",
        organization_id="other-org",
    )
    await client.post(
        "/api/tasks",
        json={"title": "Hidden urgent task", "priority": "urgent", "due_date": overdue},
        headers=headers_for(other_user),
    )

    res = await client.get("/api/tasks/work-queue", headers=auth_headers)

    assert res.status_code == 200
    queue = res.json()
    assert queue["open_count"] == 3
    assert queue["urgent_count"] == 1
    assert queue["high_priority_count"] == 2
    assert queue["overdue_count"] == 1
    assert queue["due_today_count"] == 1
    assert queue["unassigned_count"] == 1
    assert queue["role_buckets"]["provider"]["open_count"] == 1
    assert queue["role_buckets"]["ma"]["open_count"] == 1
    assert queue["role_buckets"]["unassigned"]["open_count"] == 1
    assert queue["source_buckets"]["document_processing"] == 1
    assert queue["source_buckets"]["checkout_handoff"] == 1
    assert queue["source_buckets"]["billing"] == 1
    assert queue["next_actions"][0]["severity"] == "critical"


@pytest.mark.asyncio
async def test_filter_tasks_by_status(client: AsyncClient, auth_headers, admin_user):
    res = await client.post("/api/tasks", json={"title": "Open task"}, headers=auth_headers)
    task_id = res.json()["id"]
    await client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )

    res = await client.get("/api/tasks?status=completed", headers=auth_headers)
    data = res.json()
    assert data["total"] == 1
    assert data["data"][0]["status"] == "completed"


@pytest.mark.asyncio
async def test_update_task_status(client: AsyncClient, auth_headers):
    res = await client.post("/api/tasks", json={"title": "In progress task"}, headers=auth_headers)
    task_id = res.json()["id"]

    res = await client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_mark_task_notifications_read_acknowledges_active_high_priority_tasks(
    client: AsyncClient, auth_headers
):
    urgent = await client.post(
        "/api/tasks",
        json={"title": "Urgent unread task", "priority": "urgent"},
        headers=auth_headers,
    )
    normal = await client.post(
        "/api/tasks",
        json={"title": "Normal unread task", "priority": "normal"},
        headers=auth_headers,
    )
    completed = await client.post(
        "/api/tasks",
        json={"title": "Completed urgent task", "priority": "urgent"},
        headers=auth_headers,
    )
    await client.patch(
        f"/api/tasks/{completed.json()['id']}",
        json={"status": "completed"},
        headers=auth_headers,
    )

    before = await client.get("/api/tasks", headers=auth_headers)
    urgent_before = next(task for task in before.json()["data"] if task["id"] == urgent.json()["id"])
    assert urgent_before["notification_acknowledged_at"] is None

    read = await client.post("/api/tasks/notifications/read", headers=auth_headers)

    assert read.status_code == 200
    assert read.json()["updated_count"] == 1
    assert read.json()["updated_ids"] == [urgent.json()["id"]]
    after = await client.get("/api/tasks", headers=auth_headers)
    tasks_by_id = {task["id"]: task for task in after.json()["data"]}
    assert tasks_by_id[urgent.json()["id"]]["notification_acknowledged_at"] is not None
    assert tasks_by_id[normal.json()["id"]]["notification_acknowledged_at"] is None
    assert tasks_by_id[completed.json()["id"]]["notification_acknowledged_at"] is None


@pytest.mark.asyncio
async def test_blocked_task_is_counted_separately_in_work_queue(client: AsyncClient, auth_headers):
    blocked = await client.post(
        "/api/tasks",
        json={"title": "Blocked records request", "priority": "high"},
        headers=auth_headers,
    )
    open_task = await client.post(
        "/api/tasks",
        json={"title": "Open follow-up", "priority": "normal"},
        headers=auth_headers,
    )

    blocked_update = await client.patch(
        f"/api/tasks/{blocked.json()['id']}",
        json={"status": "blocked"},
        headers=auth_headers,
    )
    queue = await client.get("/api/tasks/work-queue", headers=auth_headers)

    assert blocked_update.status_code == 200
    assert blocked_update.json()["status"] == "blocked"
    assert queue.json()["open_count"] == 1
    assert queue.json()["blocked_count"] == 1
    assert queue.json()["high_priority_count"] == 1
    assert open_task.json()["status"] == "open"


@pytest.mark.asyncio
async def test_complete_task(client: AsyncClient, auth_headers):
    res = await client.post("/api/tasks", json={"title": "To complete"}, headers=auth_headers)
    task_id = res.json()["id"]

    res = await client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )
    assert res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_task_not_found(client: AsyncClient, auth_headers):
    res = await client.get(
        "/api/tasks/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_task_list_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await client.post("/api/tasks", json={"title": "Default org task"}, headers=auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get("/api/tasks", headers=headers_for(other_user))

    assert res.status_code == 200
    assert res.json()["total"] == 0


@pytest.mark.asyncio
async def test_task_get_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    create_res = await client.post(
        "/api/tasks",
        json={"title": "Hidden org task"},
        headers=auth_headers,
    )
    task_id = create_res.json()["id"]
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-get-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get(f"/api/tasks/{task_id}", headers=headers_for(other_user))

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_task_create_rejects_cross_org_patient(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-patient-admin@clinic.example.com",
        organization_id="other-org",
    )
    other_patient = await client.post(
        "/api/patients",
        json={
            "first_name": "Other",
            "last_name": "Patient",
            "dob": "1990-01-01",
            "gender": "Unknown",
        },
        headers=headers_for(other_user),
    )

    res = await client.post(
        "/api/tasks",
        json={"title": "Cross-org patient task", "patient_id": other_patient.json()["id"]},
        headers=auth_headers,
    )

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_task_update_rejects_cross_org_patient(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    task = await client.post(
        "/api/tasks",
        json={"title": "Default task"},
        headers=auth_headers,
    )
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-update-patient-admin@clinic.example.com",
        organization_id="other-org",
    )
    other_patient = await client.post(
        "/api/patients",
        json={
            "first_name": "Other",
            "last_name": "Update",
            "dob": "1990-01-01",
            "gender": "Unknown",
        },
        headers=headers_for(other_user),
    )

    res = await client.patch(
        f"/api/tasks/{task.json()['id']}",
        json={"patient_id": other_patient.json()["id"]},
        headers=auth_headers,
    )

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_task_update_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    create_res = await client.post(
        "/api/tasks",
        json={"title": "Protected org task"},
        headers=auth_headers,
    )
    task_id = create_res.json()["id"]
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-task-update-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "completed"},
        headers=headers_for(other_user),
    )

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_task_assignee_must_belong_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    other_user = await make_user(
        db,
        UserRole.ma,
        "other-org-task-assignee@clinic.example.com",
        organization_id="other-org",
    )

    create_res = await client.post(
        "/api/tasks",
        json={"title": "Invalid assignee", "assigned_to_id": other_user.id},
        headers=auth_headers,
    )

    assert create_res.status_code == 404


@pytest.mark.asyncio
async def test_patient_outreach_draft_for_patient_task(client: AsyncClient, auth_headers):
    patient_res = await client.post(
        "/api/patients",
        json={
            "first_name": "Outreach",
            "last_name": "Patient",
            "dob": "1990-01-01",
            "gender": "Unknown",
            "phone": "555-0100",
            "email": "outreach.patient@example.com",
            "email_consent": True,
            "preferred_contact_channel": "email",
        },
        headers=auth_headers,
    )
    patient_id = patient_res.json()["id"]
    task_res = await client.post(
        "/api/tasks",
        json={"title": "Discuss lab follow-up", "patient_id": patient_id},
        headers=auth_headers,
    )

    res = await client.post(
        f"/api/tasks/{task_res.json()['id']}/patient-outreach",
        headers=auth_headers,
    )

    assert res.status_code == 200
    draft = res.json()
    assert draft["patient_id"] == patient_id
    assert draft["patient_email"] == "outreach.patient@example.com"
    assert (
        next(option for option in draft["channel_options"] if option["channel"] == "email")[
            "eligible"
        ]
        is True
    )
    assert (
        next(option for option in draft["channel_options"] if option["channel"] == "sms")[
            "eligible"
        ]
        is False
    )
    assert "Discuss lab follow-up" in draft["subject"]

    delivery = await client.post(
        f"/api/tasks/{task_res.json()['id']}/patient-outreach/deliver",
        json={"channel": "email", "subject": draft["subject"], "body": draft["body"]},
        headers=auth_headers,
    )

    assert delivery.status_code == 200
    assert delivery.json()["delivery_status"] == "queued"
    assert delivery.json()["recipient"] == "outreach.patient@example.com"
    assert delivery.json()["provider_message_id"].startswith("pending-")
    assert delivery.json()["attempts"] == 1
    assert delivery.json()["eligible"] is True

    listed = await client.get(f"/api/tasks?patient_id={patient_id}", headers=auth_headers)
    delivered_task = listed.json()["data"][0]
    assert delivered_task["delivery_channel"] == "email"
    assert delivered_task["delivery_status"] == "queued"
    assert delivered_task["delivery_recipient"] == "outreach.patient@example.com"

    audit = await client.get("/api/audit?entity_type=task", headers=auth_headers)
    assert any(event["event_type"] == "patient_outreach.staged" for event in audit.json()["data"])


@pytest.mark.asyncio
async def test_patient_outreach_blocks_without_channel_consent(client: AsyncClient, auth_headers):
    patient_res = await client.post(
        "/api/patients",
        json={
            "first_name": "No",
            "last_name": "Consent",
            "dob": "1990-01-01",
            "gender": "Unknown",
            "phone": "555-0100",
            "email": "no.consent@example.com",
        },
        headers=auth_headers,
    )
    task_res = await client.post(
        "/api/tasks",
        json={"title": "Consent guarded outreach", "patient_id": patient_res.json()["id"]},
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
    summary = await client.get("/api/tasks/patient-outreach/summary", headers=auth_headers)

    assert delivery.status_code == 200
    assert delivery.json()["delivery_status"] == "blocked"
    assert delivery.json()["provider_message_id"] is None
    assert delivery.json()["eligible"] is False
    assert "consent" in delivery.json()["blocked_reason"]
    assert delivery.json()["retryable"] is True
    assert summary.json()["blocked_count"] == 1
    assert summary.json()["consent_blocked_count"] == 1
