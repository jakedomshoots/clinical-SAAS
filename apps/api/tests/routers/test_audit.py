import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.auth_service import create_access_token, hash_password
from app.services.audit_service import log_event
from tests.conftest import headers_for, make_user


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


@pytest.mark.asyncio
async def test_export_audit_events_csv(client: AsyncClient, auth_headers):
    await client.post("/api/tasks", json={"title": "Exported audit task"}, headers=auth_headers)

    res = await client.get("/api/audit/export?entity_type=task", headers=auth_headers)

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    assert "organization_id,created_at,actor_id,event_type,entity_type,entity_id" in res.text
    assert "task.created,task" in res.text


@pytest.mark.asyncio
async def test_audit_export_neutralizes_formula_values(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await log_event(
        db,
        "=HYPERLINK(\"https://example.test\")",
        "task",
        "+formula-event",
        payload={"patient_id": "+patient"},
        organization_id="default",
    )

    res = await client.get("/api/audit/export", headers=auth_headers)

    assert res.status_code == 200
    assert "\"'=HYPERLINK(\"\"https://example.test\"\")\"" in res.text
    assert "'+formula-event" in res.text


@pytest.mark.asyncio
async def test_export_audit_events_logs_export_evidence(client: AsyncClient, auth_headers):
    await client.post("/api/tasks", json={"title": "Export evidence task"}, headers=auth_headers)

    export = await client.get("/api/audit/export?entity_type=task&limit=500", headers=auth_headers)
    audit = await client.get("/api/audit?event_type=audit.exported", headers=auth_headers)
    alert_rules = await client.get("/api/operations/alert-rules", headers=auth_headers)

    assert export.status_code == 200
    assert audit.status_code == 200
    event = audit.json()["data"][0]
    assert event["event_type"] == "audit.exported"
    assert event["entity_type"] == "audit"
    assert event["payload"]["filters"]["entity_type"] == "task"
    assert event["payload"]["limit"] == 500
    assert event["payload"]["row_count"] == 1

    rule = next(item for item in alert_rules.json()["data"] if item["key"] == "audit_export_review")
    assert rule["status"] == "triggered"
    assert rule["severity"] == "warning"
    assert rule["route"] == "/operations"


@pytest.mark.asyncio
async def test_audit_events_require_admin_or_manager(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = User(
        email="audit-provider@clinic.example.com",
        hashed_password=hash_password("provider123!"),
        display_name="Audit Limited Provider",
        role=UserRole.provider,
        is_active=True,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    token = create_access_token(provider.id, provider.role.value)

    res = await client.get("/api/audit", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_export_audit_events_requires_admin_or_manager(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = User(
        email="audit-export-provider@clinic.example.com",
        hashed_password=hash_password("provider123!"),
        display_name="Audit Export Limited Provider",
        role=UserRole.provider,
        is_active=True,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    token = create_access_token(provider.id, provider.role.value)

    res = await client.get("/api/audit/export", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_patient_access_history_requires_admin_or_manager(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = await make_user(
        db,
        UserRole.provider,
        "audit-access-history-provider@clinic.example.com",
    )

    res = await client.get(
        "/api/audit/patients/patient-1/access-history",
        headers=headers_for(provider),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_audit_events_are_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await client.post("/api/tasks", json={"title": "Default audit task"}, headers=auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-audit-admin@clinic.example.com",
        organization_id="other-org",
    )
    await client.post(
        "/api/tasks",
        json={"title": "Other audit task"},
        headers=headers_for(other_user),
    )

    default_res = await client.get("/api/audit?entity_type=task", headers=auth_headers)
    other_res = await client.get(
        "/api/audit?entity_type=task",
        headers=headers_for(other_user),
    )

    assert default_res.status_code == 200
    assert default_res.json()["total"] == 1
    assert default_res.json()["data"][0]["organization_id"] == "default"
    assert other_res.status_code == 200
    assert other_res.json()["total"] == 1
    assert other_res.json()["data"][0]["organization_id"] == "other-org"


@pytest.mark.asyncio
async def test_audit_export_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await client.post("/api/tasks", json={"title": "Default export task"}, headers=auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-audit-export-admin@clinic.example.com",
        organization_id="other-org",
    )
    await client.post(
        "/api/tasks",
        json={"title": "Other export task"},
        headers=headers_for(other_user),
    )

    res = await client.get("/api/audit/export?entity_type=task", headers=auth_headers)

    assert res.status_code == 200
    assert ",default," in res.text
    assert ",other-org," not in res.text


@pytest.mark.asyncio
async def test_audit_review_summary_groups_sensitive_events_by_category(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await log_event(
        db,
        "patient_document.accessed",
        "patient_document",
        "doc-1",
        payload={"patient_id": "patient-1"},
    )
    await log_event(
        db,
        "patient_document.download_handoff",
        "patient_document",
        "doc-1",
        payload={"patient_id": "patient-1", "presigned": False},
    )
    await log_event(db, "assistant.task_created", "task", "task-1", payload={"patient_id": "patient-1"})
    await log_event(db, "user.updated", "user", "user-1", payload={"role": "manager"})
    await log_event(db, "patient_outreach.staged", "task", "task-2", payload={"patient_id": "patient-1"})
    await log_event(db, "integration_event.retry", "integration_event", "event-1", payload={"integration": "ehr"})
    await log_event(db, "task.created", "task", "task-3", payload={})

    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-audit-review-admin@clinic.example.com",
        organization_id="other-org",
    )
    await log_event(
        db,
        "patient_document.accessed",
        "patient_document",
        "other-doc",
        actor_id=other_user.id,
        payload={"patient_id": "other-patient"},
    )

    res = await client.get("/api/audit/review-summary", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    categories = {item["key"]: item for item in data["categories"]}
    assert data["sensitive_event_count"] == 6
    assert data["total_event_count"] == 7
    assert categories["document_access"]["count"] == 2
    assert categories["assistant_actions"]["count"] == 1
    assert categories["user_administration"]["count"] == 1
    assert categories["patient_outreach"]["count"] == 1
    assert categories["integration_operations"]["count"] == 1
    assert all(item["route"] for item in data["recommended_actions"])
    document_action = next(item for item in data["recommended_actions"] if item["key"] == "document_access")
    assert document_action["route"].startswith("/audit")


@pytest.mark.asyncio
async def test_patient_chart_reads_feed_access_history_and_review_summary(
    client: AsyncClient,
    auth_headers,
):
    patient = await client.post(
        "/api/patients",
        json={
            "first_name": "Access",
            "last_name": "History",
            "dob": "1980-01-01",
            "gender": "Unknown",
        },
        headers=auth_headers,
    )
    patient_id = patient.json()["id"]

    profile = await client.get(f"/api/patients/{patient_id}", headers=auth_headers)
    chart = await client.get(f"/api/patients/{patient_id}/chart-summary", headers=auth_headers)
    medications = await client.get(f"/api/patients/{patient_id}/medications", headers=auth_headers)
    care_plan = await client.get(f"/api/patients/{patient_id}/care-plan", headers=auth_headers)
    labs = await client.get(f"/api/patients/{patient_id}/labs", headers=auth_headers)
    encounters = await client.get(f"/api/patients/{patient_id}/encounters", headers=auth_headers)
    checkout = await client.get(f"/api/patients/{patient_id}/checkout-handoff", headers=auth_headers)
    history = await client.get(f"/api/audit/patients/{patient_id}/access-history", headers=auth_headers)
    review = await client.get("/api/audit/review-summary", headers=auth_headers)

    assert profile.status_code == 200
    assert chart.status_code == 200
    assert medications.status_code == 200
    assert care_plan.status_code == 200
    assert labs.status_code == 200
    assert encounters.status_code == 200
    assert checkout.status_code == 200

    assert history.status_code == 200
    event_types = {event["event_type"] for event in history.json()["data"]}
    assert {
        "patient.profile_viewed",
        "patient_chart.viewed",
        "patient_clinical.medications_viewed",
        "patient_clinical.care_plan_viewed",
        "patient_clinical.labs_viewed",
        "patient_clinical.encounters_viewed",
        "patient_checkout_handoff.viewed",
    } <= event_types

    categories = {item["key"]: item for item in review.json()["categories"]}
    assert categories["patient_chart_access"]["count"] >= 7


@pytest.mark.asyncio
async def test_audit_review_summary_requires_admin_or_manager(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = await make_user(
        db,
        UserRole.provider,
        "audit-review-provider@clinic.example.com",
    )

    res = await client.get("/api/audit/review-summary", headers=headers_for(provider))

    assert res.status_code == 403
