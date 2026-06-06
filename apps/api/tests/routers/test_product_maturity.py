from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.integration_event import IntegrationEvent, IntegrationEventStatus
from app.models.user import User, UserRole
from app.services.auth_service import hash_password
from tests.conftest import headers_for, make_user


async def create_patient(client, auth_headers) -> str:
    res = await client.post(
        "/api/patients",
        json={"first_name": "Maturity", "last_name": "Patient", "dob": date(1980, 1, 1).isoformat(), "gender": "Unknown", "insurance": {"provider": "Aetna", "plan": "PPO", "member_id": "A-1"}},
        headers=auth_headers,
    )
    return res.json()["id"]


@pytest.mark.asyncio
async def test_portal_intake_and_billing_cases_feed_analytics(client, auth_headers):
    patient_id = await create_patient(client, auth_headers)

    intake = await client.post(
        "/api/portal-intake",
        json={"patient_id": patient_id, "submitted_payload": {"phone": "555-0101", "reason": "new forms"}},
        headers=auth_headers,
    )
    billing = await client.post(
        "/api/billing/cases",
        json={"patient_id": patient_id, "cpt_codes": ["99213"], "diagnosis_codes": ["I10"]},
        headers=auth_headers,
    )
    summary = await client.get("/api/analytics/summary", headers=auth_headers)

    assert intake.status_code == 201
    assert billing.status_code == 201
    assert billing.json()["payer"] == "Aetna"
    assert summary.json()["front_office"]["intake_needing_review"] == 1
    assert summary.json()["billing"]["draft_cases"] == 1

    transitioned = await client.patch(
        f"/api/billing/cases/{billing.json()['id']}",
        json={"status": "denied", "notes": "Missing modifier"},
        headers=auth_headers,
    )
    assert transitioned.status_code == 200
    assert transitioned.json()["status"] == "denied"

    reworked_initial = await client.post(f"/api/billing/cases/{billing.json()['id']}/rework", json={"notes": "Corrected modifier before initial submission."}, headers=auth_headers)
    eligibility = await client.post(f"/api/billing/eligibility/{patient_id}", headers=auth_headers)
    submitted = await client.post(f"/api/billing/cases/{billing.json()['id']}/submit", headers=auth_headers)
    assert reworked_initial.status_code == 200
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["claim_control_number"]

    denied = await client.post(f"/api/billing/cases/{billing.json()['id']}/deny", json={"notes": "Payer requested documentation"}, headers=auth_headers)
    assert denied.status_code == 200
    assert denied.json()["status"] == "denied"

    reworked = await client.post(f"/api/billing/cases/{billing.json()['id']}/rework", json={"notes": "Corrected modifier and documentation."}, headers=auth_headers)
    resubmitted = await client.post(f"/api/billing/cases/{billing.json()['id']}/submit", headers=auth_headers)
    paid = await client.post(f"/api/billing/cases/{billing.json()['id']}/payment", json={"paid_amount": 92.50, "allowed_amount": 120.0}, headers=auth_headers)
    assert reworked.status_code == 200
    assert resubmitted.status_code == 200
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"
    assert paid.json()["remittance_status"] == "received"

    case_timeline = await client.get(f"/api/billing/cases/{billing.json()['id']}/timeline", headers=auth_headers)
    assert case_timeline.status_code == 200
    assert case_timeline.json()["total"] >= 3
    assert any(event["source"] == "integration" and event["status"] == "pending" for event in case_timeline.json()["data"])

    history = await client.get(f"/api/billing/eligibility/{patient_id}/history", headers=auth_headers)
    assert eligibility.status_code == 200
    assert history.status_code == 200
    assert history.json()["data"][0]["event_type"] == "billing.eligibility_checked"


@pytest.mark.asyncio
async def test_portal_intake_conversions(client, auth_headers, admin_user):
    patient_id = await create_patient(client, auth_headers)
    intake = await client.post(
        "/api/portal-intake",
        json={
            "patient_id": patient_id,
            "request_type": "intake_form",
            "submitted_payload": {
                "phone": "555-2020",
                "insurance": {"provider": "Cigna", "plan": "Open Access", "member_id": "C-1"},
            },
        },
        headers=auth_headers,
    )
    applied = await client.post(f"/api/portal-intake/{intake.json()['id']}/apply-to-patient", headers=auth_headers)
    patient = await client.get(f"/api/patients/{patient_id}", headers=auth_headers)
    assert applied.status_code == 200
    assert patient.json()["phone"] == "555-2020"

    document_intake = await client.post(
        "/api/portal-intake",
        json={"patient_id": patient_id, "request_type": "document_upload", "submitted_payload": {"title": "Insurance card", "document_type": "Insurance"}},
        headers=auth_headers,
    )
    document = await client.post(f"/api/portal-intake/{document_intake.json()['id']}/convert-document", headers=auth_headers)
    assert document.status_code == 200
    assert document.json()["title"] == "Insurance card"

    appt_intake = await client.post(
        "/api/portal-intake",
        json={
            "patient_id": patient_id,
            "request_type": "appointment_request",
            "submitted_payload": {
                "provider_id": admin_user.id,
                "start_time": "2026-06-05T09:00:00",
                "end_time": "2026-06-05T09:30:00",
            },
        },
        headers=auth_headers,
    )
    appointment = await client.post(f"/api/portal-intake/{appt_intake.json()['id']}/convert-appointment", headers=auth_headers)
    assert appointment.status_code == 200
    assert appointment.json()["patient_id"] == patient_id


@pytest.mark.asyncio
async def test_charge_review_queue_clears_after_billing_case_creation(client, auth_headers, admin_user):
    patient_id = await create_patient(client, auth_headers)
    start_time = datetime(2026, 6, 8, 10, 0)
    appointment = await client.post(
        "/api/schedule/appointments",
        json={
            "patient_id": patient_id,
            "provider_id": admin_user.id,
            "start_time": start_time.isoformat(),
            "end_time": (start_time + timedelta(minutes=30)).isoformat(),
            "type": "Office visit",
        },
        headers=auth_headers,
    )
    assert appointment.status_code == 201

    encounter = await client.post(
        f"/api/patients/{patient_id}/encounters",
        json={
            "appointment_id": appointment.json()["id"],
            "provider_id": admin_user.id,
            "encounter_type": "Office visit",
            "status": "signed",
            "summary": "Signed note ready for charge capture.",
        },
        headers=auth_headers,
    )
    assert encounter.status_code == 201

    review = await client.get("/api/billing/charge-review", headers=auth_headers)
    assert review.status_code == 200
    assert review.json()["total"] == 1
    assert review.json()["data"][0]["encounter_id"] == encounter.json()["id"]

    billing = await client.post(f"/api/billing/cases/from-encounter/{encounter.json()['id']}", headers=auth_headers)
    assert billing.status_code == 201
    assert billing.json()["appointment_id"] == appointment.json()["id"]

    cleared = await client.get("/api/billing/charge-review", headers=auth_headers)
    assert cleared.json()["total"] == 0


@pytest.mark.asyncio
async def test_billing_claim_readiness_and_work_queue(client, auth_headers):
    patient_id = await create_patient(client, auth_headers)
    billing = await client.post(
        "/api/billing/cases",
        json={"patient_id": patient_id, "cpt_codes": ["99213"], "diagnosis_codes": []},
        headers=auth_headers,
    )

    blocked = await client.post(f"/api/billing/cases/{billing.json()['id']}/submit", headers=auth_headers)
    readiness = await client.get(f"/api/billing/cases/{billing.json()['id']}/readiness", headers=auth_headers)
    queue = await client.get("/api/billing/work-queue", headers=auth_headers)

    assert blocked.status_code == 400
    assert "Diagnosis codes are required" in blocked.json()["detail"]
    assert readiness.status_code == 200
    assert readiness.json()["ready"] is False
    assert "Diagnosis codes are required." in readiness.json()["blockers"]
    assert queue.json()["missing_coding_count"] == 1

    await client.patch(
        f"/api/billing/cases/{billing.json()['id']}",
        json={"diagnosis_codes": ["I10"]},
        headers=auth_headers,
    )
    await client.post(f"/api/billing/eligibility/{patient_id}", headers=auth_headers)
    ready = await client.get(f"/api/billing/cases/{billing.json()['id']}/readiness", headers=auth_headers)
    submitted = await client.post(f"/api/billing/cases/{billing.json()['id']}/submit", headers=auth_headers)
    queue_after = await client.get("/api/billing/work-queue", headers=auth_headers)

    assert ready.json()["ready"] is True
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"
    assert queue_after.json()["remittance_pending_count"] == 1


@pytest.mark.asyncio
async def test_daily_closeout_reports_operational_aging_and_actions(
    client,
    auth_headers,
    db: AsyncSession,
):
    patient_id = await create_patient(client, auth_headers)
    now = datetime.now()
    stale_due = now - timedelta(days=3)

    task = await client.post(
        "/api/tasks",
        json={
            "title": "Call patient about outside labs",
            "description": "Needs same-day follow up before checkout",
            "priority": "urgent",
            "due_date": stale_due.isoformat(),
            "patient_id": patient_id,
        },
        headers=auth_headers,
    )
    document = await client.post(
        f"/api/patients/{patient_id}/documents",
        json={
            "title": "Outside cardiology notes",
            "source": "Cardiology Associates",
            "document_type": "Consult note",
            "status": "needs_review",
            "pages": 4,
            "received_at": (now - timedelta(days=8)).isoformat(),
        },
        headers=auth_headers,
    )
    medication = await client.post(
        f"/api/patients/{patient_id}/medications",
        json={
            "name": "Warfarin",
            "dose": "5 mg",
            "directions": "Daily",
            "source": "Outside med list",
            "status": "review",
        },
        headers=auth_headers,
    )
    lab = await client.post(
        f"/api/patients/{patient_id}/labs",
        json={
            "collected_at": "2026-06-03T08:00:00",
            "panel": "INR",
            "result": "INR 5.2",
            "flag": "Critical",
            "status": "needs_review",
            "source": "Outside Lab",
        },
        headers=auth_headers,
    )
    care_plan = await client.post(
        f"/api/patients/{patient_id}/care-plan",
        json={
            "owner_role": "Provider",
            "item": "Adjust anticoagulation plan before checkout.",
            "due": "Today",
            "status": "blocked",
            "escalation": "Provider",
        },
        headers=auth_headers,
    )
    billing = await client.post(
        "/api/billing/cases",
        json={"patient_id": patient_id, "cpt_codes": ["99213"], "diagnosis_codes": []},
        headers=auth_headers,
    )
    db.add(
        IntegrationEvent(
            organization_id="default",
            integration="ehr",
            direction="inbound",
            action="sync_patient",
            status=IntegrationEventStatus.failed,
            entity_type="patient",
            entity_id=patient_id,
            attempts=2,
            error="Timeout",
        )
    )
    await db.commit()

    closeout = await client.get("/api/analytics/daily-closeout", headers=auth_headers)

    assert task.status_code == 201
    assert document.status_code == 201
    assert medication.status_code == 201
    assert lab.status_code == 201
    assert care_plan.status_code == 201
    assert billing.status_code == 201
    assert closeout.status_code == 200
    data = closeout.json()
    assert data["status"] == "attention"
    assert data["totals"]["open_tasks"] == 1
    assert data["totals"]["overdue_tasks"] == 1
    assert data["totals"]["urgent_tasks"] == 1
    assert data["totals"]["documents_needing_review"] == 1
    assert data["totals"]["failed_integrations"] == 1
    assert data["totals"]["medications_needing_review"] == 1
    assert data["totals"]["labs_needing_review"] == 1
    assert data["totals"]["care_plan_blockers"] == 1
    assert data["aging"]["tasks_over_48h"] == 1
    assert data["aging"]["documents_over_72h"] == 1
    assert data["billing"]["missing_coding_count"] == 1
    assert any(action["key"] == "urgent_tasks" for action in data["recommended_actions"])
    assert any(action["key"] == "documents_over_72h" for action in data["recommended_actions"])
    assert any(action["key"] == "clinical_review" for action in data["recommended_actions"])
    assert any(item["label"] == "Billing coding gaps" for item in data["risk_register"])
    assert any(item["label"] == "Clinical review blockers" for item in data["risk_register"])
    assert data["generated_at"]


@pytest.mark.asyncio
async def test_security_templates_and_integration_capabilities(client, auth_headers):
    policy = await client.get("/api/auth/session-policy", headers=auth_headers)
    templates = await client.get("/api/clinical/encounter-templates", headers=auth_headers)
    capabilities = await client.get("/api/integration-capabilities", headers=auth_headers)

    assert policy.status_code == 200
    assert policy.json()["access_token_expire_minutes"] > 0
    assert templates.json()["total"] >= 2
    assert "fhir_placeholder" in capabilities.json()["ehr"]["supports"]
    assert capabilities.json()["ehr"]["action"]
    assert capabilities.json()["copilotkit"]["configured"] is False
    assert "era_remittance" in capabilities.json()["clearinghouse"]["supports"]


@pytest.mark.asyncio
async def test_launch_readiness_contract(client, auth_headers):
    readiness = await client.get("/api/launch-readiness", headers=auth_headers)

    assert readiness.status_code == 200
    data = readiness.json()
    assert data["production_ready"] is False
    assert data["critical_blockers"] > 0
    assert data["score"] >= 0
    requirement_keys = {item["key"] for item in data["requirements"]}
    assert "secret_key" in requirement_keys
    assert "webhook_secret" in requirement_keys
    assert "integration_ehr" in requirement_keys
    assert "integration_clearinghouse" in requirement_keys
    assert all(item["action"] for item in data["requirements"])


@pytest.mark.asyncio
async def test_operations_incidents_and_readiness_snapshots(client, auth_headers, db: AsyncSession):
    patient_id = await create_patient(client, auth_headers)
    db.add(
        IntegrationEvent(
            organization_id="default",
            integration="fax_provider",
            direction="inbound",
            action="download_document",
            status=IntegrationEventStatus.failed,
            entity_type="patient",
            entity_id=patient_id,
            attempts=3,
            error="Provider timeout",
        )
    )
    await db.commit()

    incidents = await client.get("/api/operations/incidents", headers=auth_headers)
    snapshot = await client.post("/api/operations/readiness-snapshots", headers=auth_headers)
    snapshots = await client.get("/api/operations/readiness-snapshots", headers=auth_headers)

    assert incidents.status_code == 200
    incident_data = incidents.json()
    assert incident_data["open_count"] > 0
    assert any(item["key"] == "integration_event_fax_provider" for item in incident_data["data"])
    assert any(item["owner_role"] == "operations" for item in incident_data["data"])
    assert all(item["recommended_action"] for item in incident_data["data"])

    assert snapshot.status_code == 201
    snapshot_data = snapshot.json()
    assert snapshot_data["incident_count"] == incident_data["open_count"]
    assert snapshot_data["operational_status"] in {"ok", "degraded"}
    assert snapshot_data["launch_score"] >= 0

    assert snapshots.status_code == 200
    assert snapshots.json()["total"] == 1
    assert snapshots.json()["data"][0]["id"] == snapshot_data["id"]


@pytest.mark.asyncio
async def test_operations_timeline_and_alert_rules_roll_up_observability_signals(
    client,
    auth_headers,
    admin_user,
    db: AsyncSession,
):
    expired_user = User(
        email="expired-onboarding@clinic.example.com",
        hashed_password=hash_password("password123!"),
        display_name="Expired Onboarding",
        role=UserRole.front_desk,
        organization_id="default",
        is_active=True,
        password_must_change=True,
        temporary_password_expires_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
    )
    db.add(expired_user)
    db.add(
        IntegrationEvent(
            organization_id="default",
            integration="fax_provider",
            direction="inbound",
            action="fax.webhook",
            status=IntegrationEventStatus.failed,
            entity_type="fax",
            entity_id="fax-observe-1",
            attempts=2,
            error="Webhook signature mismatch",
            payload={"source": "observability-test"},
        )
    )
    db.add(
        AuditLog(
            organization_id="default",
            actor_id=admin_user.id,
            event_type="auth.login_blocked",
            entity_type="user",
            entity_id=admin_user.id,
            payload={"reason": "mfa_required"},
        )
    )
    db.add(
        AuditLog(
            organization_id="default",
            actor_id=admin_user.id,
            event_type="patient_document.download_handoff",
            entity_type="patient_document",
            entity_id="document-observe-1",
            payload={"patient_id": "patient-observe-1"},
        )
    )
    await db.commit()

    timeline = await client.get("/api/operations/incident-timeline", headers=auth_headers)
    alert_rules = await client.get("/api/operations/alert-rules", headers=auth_headers)

    assert timeline.status_code == 200
    timeline_data = timeline.json()
    assert timeline_data["total"] >= 3
    assert timeline_data["critical_count"] >= 1
    timeline_keys = {item["key"] for item in timeline_data["data"]}
    assert "integration_event:fax_provider:fax.webhook" in timeline_keys
    assert "audit_event:auth.login_blocked" in timeline_keys
    assert "audit_event:patient_document.download_handoff" in timeline_keys
    assert all(item["occurred_at"] for item in timeline_data["data"])
    assert all(item["route"] for item in timeline_data["data"])

    assert alert_rules.status_code == 200
    rules_data = alert_rules.json()
    assert rules_data["total"] >= 5
    assert rules_data["triggered_count"] >= 3
    rule_keys = {item["key"] for item in rules_data["data"]}
    assert {
        "failed_integrations",
        "blocked_logins",
        "expired_onboarding",
        "backup_restore_gap",
        "document_access_review",
    } <= rule_keys
    failed_integrations = next(item for item in rules_data["data"] if item["key"] == "failed_integrations")
    assert failed_integrations["status"] == "triggered"
    assert "Webhook signature mismatch" in failed_integrations["detail"]


@pytest.mark.asyncio
async def test_document_storage_readiness_surfaces_handoff_and_storage_gaps(
    client,
    auth_headers,
    admin_user,
    db: AsyncSession,
):
    patient_id = await create_patient(client, auth_headers)
    metadata_document = await client.post(
        f"/api/patients/{patient_id}/documents",
        json={
            "title": "Outside records without file",
            "source": "Outside clinic",
            "document_type": "Records",
            "status": "needs_review",
        },
        headers=auth_headers,
    )
    file_document = await client.post(
        f"/api/patients/{patient_id}/documents",
        json={
            "title": "Uploaded referral PDF",
            "source": "Referral office",
            "document_type": "Referral",
            "status": "needs_review",
            "file_url": "s3://concierge-documents/patients/p-1/referral.pdf",
        },
        headers=auth_headers,
    )
    db.add(
        AuditLog(
            organization_id="default",
            actor_id=admin_user.id,
            event_type="patient_document.download_handoff",
            entity_type="patient_document",
            entity_id=file_document.json()["id"],
            payload={
                "patient_id": patient_id,
                "storage_status": "signed_handoff",
                "presigned": False,
                "expires_at": (datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=5)).isoformat(),
            },
        )
    )
    db.add(
        AuditLog(
            organization_id="default",
            actor_id=admin_user.id,
            event_type="patient_document.accessed",
            entity_type="patient_document",
            entity_id=metadata_document.json()["id"],
            payload={
                "patient_id": patient_id,
                "storage_status": "metadata_only",
                "has_file": False,
            },
        )
    )
    await db.commit()

    readiness = await client.get("/api/operations/document-storage-readiness", headers=auth_headers)
    alert_rules = await client.get("/api/operations/alert-rules", headers=auth_headers)

    assert readiness.status_code == 200
    data = readiness.json()
    assert data["status"] in {"attention", "blocked"}
    assert data["score"] < 100
    assert data["summary"]["metadata_only_documents"] >= 1
    assert data["summary"]["unsigned_handoffs"] >= 1
    assert data["summary"]["expired_handoffs"] >= 1
    assert "signing_gaps" in data["summary"]
    check_keys = {check["key"] for check in data["checks"]}
    assert {
        "object_storage_credentials",
        "object_storage_signing",
        "metadata_only_documents",
        "unsigned_handoffs",
        "expired_handoffs",
    } <= check_keys
    assert any(item["document_id"] == file_document.json()["id"] for item in data["recent_handoffs"])

    rules = alert_rules.json()["data"]
    storage_rule = next(item for item in rules if item["key"] == "document_storage_readiness")
    assert storage_rule["status"] == "triggered"
    assert storage_rule["severity"] in {"warning", "critical"}
    assert storage_rule["count"] >= 1


@pytest.mark.asyncio
async def test_production_rehearsal_report_contract(client, auth_headers):
    rehearsal = await client.get("/api/operations/production-rehearsal", headers=auth_headers)

    assert rehearsal.status_code == 200
    data = rehearsal.json()
    assert data["status"] in {"ready", "attention"}
    assert data["score"] >= 0
    assert data["blocking_count"] >= 0
    gate_keys = {gate["key"] for gate in data["gates"]}
    assert {
        "core_readiness",
        "daily_closeout",
        "incident_register",
        "launch_readiness",
        "credential_preflight",
        "access_review",
        "backup_restore",
    } <= gate_keys
    assert all(gate["route"] for gate in data["gates"])
    assert all(action["route"] for action in data["recommended_actions"])


@pytest.mark.asyncio
async def test_production_rehearsal_snapshot_and_export(client, auth_headers):
    snapshot = await client.post("/api/operations/production-rehearsal/snapshots", headers=auth_headers)
    snapshots = await client.get("/api/operations/production-rehearsal/snapshots", headers=auth_headers)
    exported = await client.get("/api/operations/production-rehearsal/export", headers=auth_headers)

    assert snapshot.status_code == 201
    snapshot_data = snapshot.json()
    assert snapshot_data["score"] >= 0
    assert snapshot_data["recommended_action_count"] >= 0

    assert snapshots.status_code == 200
    assert snapshots.json()["total"] == 1
    assert snapshots.json()["data"][0]["id"] == snapshot_data["id"]

    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    assert "section,key,label,status,score,detail,route,severity" in exported.text
    assert "gate,core_readiness,Core readiness" in exported.text


@pytest.mark.asyncio
async def test_production_rehearsal_action_assignment(client, auth_headers):
    rehearsal = await client.get("/api/operations/production-rehearsal", headers=auth_headers)
    action = rehearsal.json()["recommended_actions"][0]

    assigned = await client.post(
        f"/api/operations/production-rehearsal/actions/{action['key']}/assignment",
        json={
            "owner_name": "Operations Lead",
            "status": "in_progress",
            "due_date": "2026-06-12",
            "note": "Own before vendor sandbox rehearsal.",
        },
        headers=auth_headers,
    )
    refreshed = await client.get("/api/operations/production-rehearsal", headers=auth_headers)
    audit = await client.get(
        "/api/audit?page=1&page_size=5&event_type=operations.rehearsal_action_assignment",
        headers=auth_headers,
    )

    assert assigned.status_code == 201
    assignment = assigned.json()
    assert assignment["action_key"] == action["key"]
    assert assignment["owner_name"] == "Operations Lead"
    assert assignment["status"] == "in_progress"

    refreshed_action = next(item for item in refreshed.json()["recommended_actions"] if item["key"] == action["key"])
    assert refreshed_action["assignment"]["owner_name"] == "Operations Lead"
    assert refreshed_action["assignment"]["due_date"] == "2026-06-12"

    assert audit.status_code == 200
    assert audit.json()["data"][0]["event_type"] == "operations.rehearsal_action_assignment"


@pytest.mark.asyncio
async def test_launch_workplan_aggregates_operational_blockers(client, auth_headers):
    before = await client.get("/api/operations/launch-workplan", headers=auth_headers)
    rehearsal = await client.get("/api/operations/production-rehearsal", headers=auth_headers)
    action = rehearsal.json()["recommended_actions"][0]

    await client.post(
        f"/api/operations/production-rehearsal/actions/{action['key']}/assignment",
        json={"owner_name": "Launch Manager", "status": "open"},
        headers=auth_headers,
    )
    after = await client.get("/api/operations/launch-workplan", headers=auth_headers)

    assert before.status_code == 200
    before_data = before.json()
    assert before_data["status"] in {"clear", "attention"}
    assert before_data["total"] >= before_data["blocking_count"]
    assert any(item["route"] for item in before_data["items"])
    assert {"rehearsal", "launch_requirement", "credential_preflight"} & {item["source"] for item in before_data["items"]}

    assert after.status_code == 200
    assert after.json()["assigned_count"] >= 1
    assigned_items = [item for item in after.json()["items"] if item["assignment"]]
    assert assigned_items[0]["assignment"]["owner_name"] == "Launch Manager"


@pytest.mark.asyncio
async def test_credential_preflight_assignment_owns_workplan_blockers(client, auth_headers):
    await client.post(
        "/api/operations/production-rehearsal/actions/credential_preflight/assignment",
        json={"owner_name": "Integration Owner", "status": "open", "due_date": "2026-06-12"},
        headers=auth_headers,
    )
    workplan = await client.get("/api/operations/launch-workplan", headers=auth_headers)

    assert workplan.status_code == 200
    credential_items = [
        item for item in workplan.json()["items"]
        if item["source"] == "credential_preflight"
    ]
    assert credential_items
    assert all(item["assignment"] for item in credential_items)
    assert {item["assignment"]["owner_name"] for item in credential_items} == {"Integration Owner"}


@pytest.mark.asyncio
async def test_launch_workplan_snapshot_and_export(client, auth_headers):
    snapshot = await client.post("/api/operations/launch-workplan/snapshots", headers=auth_headers)
    snapshots = await client.get("/api/operations/launch-workplan/snapshots", headers=auth_headers)
    exported = await client.get("/api/operations/launch-workplan/export", headers=auth_headers)

    assert snapshot.status_code == 201
    snapshot_data = snapshot.json()
    assert snapshot_data["total"] >= snapshot_data["blocking_count"]
    assert snapshot_data["unassigned_count"] >= 0
    assert snapshot_data["unassigned_blocking_count"] >= 0

    assert snapshots.status_code == 200
    assert snapshots.json()["total"] == 1
    assert snapshots.json()["data"][0]["id"] == snapshot_data["id"]

    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    assert "key,source,category,label,severity,detail,route,owner_role,recommended_action,owner,assignment_status,due_date,note" in exported.text


@pytest.mark.asyncio
async def test_go_live_packet_blocks_unassigned_launch_workplan_snapshot(client, auth_headers):
    snapshot = await client.post("/api/operations/launch-workplan/snapshots", headers=auth_headers)

    packet = await client.get("/api/operations/go-live-packet", headers=auth_headers)

    assert snapshot.status_code == 201
    assert snapshot.json()["unassigned_blocking_count"] > 0
    assert packet.status_code == 200
    workplan_evidence = next(
        item for item in packet.json()["evidence"]
        if item["key"] == "launch_workplan_snapshot"
    )
    assert workplan_evidence["status"] == "blocking"
    assert "unassigned blocking" in workplan_evidence["detail"]


@pytest.mark.asyncio
async def test_go_live_packet_combines_launch_evidence(client, auth_headers):
    await client.post("/api/operations/readiness-snapshots", headers=auth_headers)
    await client.post("/api/operations/launch-workplan/snapshots", headers=auth_headers)
    await client.post("/api/operations/production-rehearsal/snapshots", headers=auth_headers)

    packet = await client.get("/api/operations/go-live-packet", headers=auth_headers)

    assert packet.status_code == 200
    data = packet.json()
    assert data["status"] in {"ready", "attention"}
    assert data["go_live_ready"] is False
    assert data["evidence_total"] >= 5
    assert data["evidence_ready_count"] >= 1
    evidence_keys = {item["key"] for item in data["evidence"]}
    assert {"readiness_snapshot", "launch_workplan_snapshot", "production_rehearsal_snapshot", "credential_preflight", "backup_restore"} <= evidence_keys
    workplan_evidence = next(
        item for item in data["evidence"]
        if item["key"] == "launch_workplan_snapshot"
    )
    rehearsal_evidence = next(
        item for item in data["evidence"]
        if item["key"] == "production_rehearsal_snapshot"
    )
    assert workplan_evidence["status"] == "blocking"
    assert rehearsal_evidence["status"] == "blocking"
    assert data["open_workplan_items"]
    assert all(item["route"] for item in data["open_workplan_items"])


@pytest.mark.asyncio
async def test_go_live_packet_attestation_is_audit_backed(client, auth_headers):
    attestation = await client.post(
        "/api/operations/go-live-packet/attestations",
        json={"decision": "needs_changes", "note": "Credential preflight and restore evidence still need work."},
        headers=auth_headers,
    )
    attestations = await client.get("/api/operations/go-live-packet/attestations", headers=auth_headers)
    packet = await client.get("/api/operations/go-live-packet", headers=auth_headers)
    audit = await client.get(
        "/api/audit?page=1&page_size=5&event_type=operations.go_live_packet_attestation",
        headers=auth_headers,
    )

    assert attestation.status_code == 201
    data = attestation.json()
    assert data["decision"] == "needs_changes"
    assert data["note"] == "Credential preflight and restore evidence still need work."
    assert data["blocking_count"] >= 0

    assert attestations.status_code == 200
    assert attestations.json()["total"] == 1
    assert attestations.json()["data"][0]["id"] == data["id"]

    assert packet.status_code == 200
    assert packet.json()["latest_attestation"]["id"] == data["id"]

    assert audit.status_code == 200
    assert audit.json()["data"][0]["event_type"] == "operations.go_live_packet_attestation"


@pytest.mark.asyncio
async def test_go_live_packet_rejects_approval_with_blockers(client, auth_headers):
    attestation = await client.post(
        "/api/operations/go-live-packet/attestations",
        json={"decision": "approved", "note": "Go for launch."},
        headers=auth_headers,
    )

    assert attestation.status_code == 400
    assert "blocking" in attestation.json()["detail"]


@pytest.mark.asyncio
async def test_restore_drill_session_evidence_feeds_go_live_packet(client, auth_headers):
    checklist = await client.get("/api/operations/restore-drill-checklist", headers=auth_headers)
    first_item = checklist.json()["items"][0]

    created = await client.post(
        "/api/operations/restore-drill-sessions",
        json={
            "session_name": "Disposable restore drill",
            "owner_name": "Ops Lead",
            "backup_reference": "backups/20260606T120000Z",
            "note": "Run on disposable local stack.",
        },
        headers=auth_headers,
    )
    session = created.json()

    updated = await client.patch(
        f"/api/operations/restore-drill-sessions/{session['session_id']}",
        json={
            "item_key": first_item["key"],
            "drill_status": "complete",
            "item_note": "Backup manifest, database dump, and object archive validated.",
            "rto_minutes": 45,
            "rpo_minutes": 15,
        },
        headers=auth_headers,
    )
    completed = await client.patch(
        f"/api/operations/restore-drill-sessions/{session['session_id']}",
        json={"session_status": "completed", "note": "Restore drill evidence captured."},
        headers=auth_headers,
    )
    sessions = await client.get("/api/operations/restore-drill-sessions", headers=auth_headers)
    exported = await client.get(
        f"/api/operations/restore-drill-sessions/{session['session_id']}/export",
        headers=auth_headers,
    )
    packet = await client.get("/api/operations/go-live-packet", headers=auth_headers)
    audit = await client.get(
        "/api/audit?page=1&page_size=5&event_type=operations.restore_drill_session",
        headers=auth_headers,
    )

    assert checklist.status_code == 200
    checklist_data = checklist.json()
    item_keys = {item["key"] for item in checklist_data["items"]}
    assert {
        "backup_created",
        "backup_validated",
        "disposable_restore",
        "application_smoke",
        "object_file_check",
        "rto_rpo_recorded",
    } <= item_keys
    assert all(item["docs"] for item in checklist_data["items"])

    assert created.status_code == 201
    assert session["session_name"] == "Disposable restore drill"
    assert session["owner_name"] == "Ops Lead"
    assert session["backup_reference"] == "backups/20260606T120000Z"
    assert session["pending_count"] == session["item_count"]

    assert updated.status_code == 200
    updated_data = updated.json()
    assert updated_data["complete_count"] == 1
    assert updated_data["rto_minutes"] == 45
    assert updated_data["rpo_minutes"] == 15

    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"]

    assert sessions.status_code == 200
    assert sessions.json()["total"] == 1
    assert sessions.json()["data"][0]["session_id"] == session["session_id"]

    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    assert "session_id,session_name,owner_name,status,backup_reference,rto_minutes,rpo_minutes,item_key,item_label,drill_status,note" in exported.text

    evidence = {item["key"]: item for item in packet.json()["evidence"]}
    assert "restore_drill_session" in evidence
    assert evidence["restore_drill_session"]["status"] == "warning"
    assert "1 complete" in evidence["restore_drill_session"]["detail"]

    assert audit.status_code == 200
    assert audit.json()["data"][0]["event_type"] == "operations.restore_drill_session"


@pytest.mark.asyncio
async def test_role_dry_run_checklists_cover_clinic_workflows(client, auth_headers):
    response = await client.get("/api/operations/role-dry-run-checklists", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    role_keys = {role["key"] for role in data["roles"]}
    assert {"front_desk", "ma_nurse", "provider", "billing", "manager"} <= role_keys
    assert data["total_roles"] == len(data["roles"])
    assert data["ready_roles"] + data["attention_roles"] == data["total_roles"]
    for role in data["roles"]:
        assert role["items"]
        assert role["ready_count"] + role["attention_count"] == role["total"]
        assert all(item["route"] for item in role["items"])


@pytest.mark.asyncio
async def test_role_dry_run_session_evidence_is_audit_backed(client, auth_headers):
    checklist = await client.get("/api/operations/role-dry-run-checklists", headers=auth_headers)
    first_role = checklist.json()["roles"][0]
    first_item = first_role["items"][0]

    created = await client.post(
        "/api/operations/role-dry-run-sessions",
        json={"session_name": "Front office rehearsal", "note": "Morning team walkthrough."},
        headers=auth_headers,
    )
    session = created.json()

    updated = await client.patch(
        f"/api/operations/role-dry-run-sessions/{session['session_id']}",
        json={
            "role_key": first_role["key"],
            "item_key": first_item["key"],
            "dry_run_status": "complete",
            "item_note": "Queue review completed with front desk.",
        },
        headers=auth_headers,
    )
    completed = await client.patch(
        f"/api/operations/role-dry-run-sessions/{session['session_id']}",
        json={"session_status": "completed", "note": "Ready for launch packet review."},
        headers=auth_headers,
    )
    sessions = await client.get("/api/operations/role-dry-run-sessions", headers=auth_headers)
    audit = await client.get(
        "/api/audit?page=1&page_size=5&event_type=operations.role_dry_run_session",
        headers=auth_headers,
    )

    assert created.status_code == 201
    assert session["session_name"] == "Front office rehearsal"
    assert session["status"] == "in_progress"
    assert session["pending_count"] == session["item_count"]

    assert updated.status_code == 200
    updated_data = updated.json()
    assert updated_data["complete_count"] == 1
    updated_item = next(
        item
        for role in updated_data["roles"]
        if role["key"] == first_role["key"]
        for item in role["items"]
        if item["key"] == first_item["key"]
    )
    assert updated_item["dry_run_status"] == "complete"
    assert updated_item["note"] == "Queue review completed with front desk."

    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"]
    assert completed.json()["note"] == "Ready for launch packet review."

    assert sessions.status_code == 200
    assert sessions.json()["total"] == 1
    assert sessions.json()["data"][0]["session_id"] == session["session_id"]

    assert audit.status_code == 200
    assert audit.json()["data"][0]["event_type"] == "operations.role_dry_run_session"


@pytest.mark.asyncio
async def test_operator_health_rollup_surfaces_production_signals(client, auth_headers, db: AsyncSession):
    db.add(
        IntegrationEvent(
            organization_id="default",
            integration="fax_provider",
            direction="inbound",
            action="fax.webhook",
            status=IntegrationEventStatus.failed,
            entity_type="fax",
            entity_id="fax-health-1",
            attempts=2,
            error="Webhook signature mismatch",
            payload={"source": "operator-health-test"},
        )
    )
    await db.commit()

    response = await client.get("/api/operations/operator-health", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in {"healthy", "attention", "critical"}
    assert data["score"] >= 0
    assert data["generated_at"]
    assert data["summary"]["failed_integration_events"] >= 1
    assert data["summary"]["credential_blockers"] >= 0
    assert data["summary"]["launch_evidence_missing"] >= 0
    check_keys = {check["key"] for check in data["checks"]}
    assert {
        "core_readiness",
        "operational_readiness",
        "backup_freshness",
        "restore_freshness",
        "integration_failures",
        "credential_preflight",
        "launch_evidence",
    } <= check_keys
    assert all(check["route"] for check in data["checks"])
    assert all(action["route"] for action in data["recommended_actions"])
    integration_check = next(check for check in data["checks"] if check["key"] == "integration_failures")
    assert integration_check["status"] == "critical"
    assert "Webhook signature mismatch" in integration_check["detail"]


@pytest.mark.asyncio
async def test_operations_surfaces_role_access_matrix_gaps(client, auth_headers, db: AsyncSession):
    await make_user(db, UserRole.manager, "manager-without-mfa-health@example.com")
    await make_user(db, UserRole.provider, "provider-health@example.com")
    await db.commit()

    health = await client.get("/api/operations/operator-health", headers=auth_headers)
    alert_rules = await client.get("/api/operations/alert-rules", headers=auth_headers)

    assert health.status_code == 200
    data = health.json()
    assert data["summary"]["role_access_warnings"] >= 1
    assert data["summary"]["privileged_mfa_gaps"] >= 1
    role_check = next(item for item in data["checks"] if item["key"] == "role_access_matrix")
    assert role_check["status"] == "critical"
    assert role_check["route"] == "/staff"
    assert "privileged" in role_check["detail"].lower()

    rule = next(item for item in alert_rules.json()["data"] if item["key"] == "role_access_matrix")
    assert rule["status"] == "triggered"
    assert rule["severity"] == "critical"
    assert rule["route"] == "/staff"


@pytest.mark.asyncio
async def test_production_config_audit_flags_launch_settings(client, auth_headers):
    response = await client.get("/api/operations/production-config-audit", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in {"ready", "attention", "blocked"}
    assert data["status"] == "blocked"
    assert data["critical_count"] > 0
    assert data["generated_at"]
    check_keys = {check["key"] for check in data["checks"]}
    assert {
        "app_env",
        "secret_key",
        "cors_origins",
        "seed_endpoints",
        "schema_migrations",
        "object_storage_startup",
        "minio_credentials",
        "webhook_secret",
        "communications_provider",
    } <= check_keys
    assert all(check["action"] for check in data["checks"])
    assert all(check["docs"] for check in data["checks"])
    assert all(check["env_vars"] for check in data["checks"] if check["key"] != "communications_provider")

    seed_check = next(check for check in data["checks"] if check["key"] == "seed_endpoints")
    assert seed_check["ready"] is False
    assert seed_check["severity"] == "critical"
    assert "ALLOW_SEED_ENDPOINT" in seed_check["env_vars"]


@pytest.mark.asyncio
async def test_browser_qa_session_evidence_is_audit_backed(client, auth_headers):
    checklist = await client.get("/api/operations/browser-qa-checklist", headers=auth_headers)
    first_item = checklist.json()["items"][0]

    created = await client.post(
        "/api/operations/browser-qa-sessions",
        json={"session_name": "Manager browser QA", "browser": "Chrome", "note": "Pre-rehearsal walkthrough."},
        headers=auth_headers,
    )
    session = created.json()

    updated = await client.patch(
        f"/api/operations/browser-qa-sessions/{session['session_id']}",
        json={
            "item_key": first_item["key"],
            "qa_status": "passed",
            "item_note": "Route loaded and core controls were visible.",
        },
        headers=auth_headers,
    )
    completed = await client.patch(
        f"/api/operations/browser-qa-sessions/{session['session_id']}",
        json={"session_status": "completed", "note": "Ready for launch packet review."},
        headers=auth_headers,
    )
    sessions = await client.get("/api/operations/browser-qa-sessions", headers=auth_headers)
    audit = await client.get(
        "/api/audit?page=1&page_size=5&event_type=operations.browser_qa_session",
        headers=auth_headers,
    )

    assert checklist.status_code == 200
    checklist_data = checklist.json()
    item_keys = {item["key"] for item in checklist_data["items"]}
    assert {
        "login",
        "patients",
        "scheduling",
        "documents",
        "faxes",
        "billing",
        "audit",
        "assistant_actions",
        "portal_intake",
        "reports",
    } <= item_keys
    assert all(item["route"] for item in checklist_data["items"])

    assert created.status_code == 201
    assert session["session_name"] == "Manager browser QA"
    assert session["browser"] == "Chrome"
    assert session["pending_count"] == session["item_count"]

    assert updated.status_code == 200
    updated_data = updated.json()
    assert updated_data["passed_count"] == 1
    updated_item = next(item for item in updated_data["items"] if item["key"] == first_item["key"])
    assert updated_item["qa_status"] == "passed"
    assert updated_item["note"] == "Route loaded and core controls were visible."

    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"]

    assert sessions.status_code == 200
    assert sessions.json()["total"] == 1
    assert sessions.json()["data"][0]["session_id"] == session["session_id"]

    assert audit.status_code == 200
    assert audit.json()["data"][0]["event_type"] == "operations.browser_qa_session"


@pytest.mark.asyncio
async def test_go_live_packet_keeps_partial_dry_run_and_browser_qa_as_warning(client, auth_headers):
    dry_run_checklist = await client.get("/api/operations/role-dry-run-checklists", headers=auth_headers)
    dry_run_role = dry_run_checklist.json()["roles"][0]
    dry_run_item = dry_run_role["items"][0]
    dry_run_created = await client.post(
        "/api/operations/role-dry-run-sessions",
        json={"session_name": "Partial role dry-run"},
        headers=auth_headers,
    )
    dry_run_session = dry_run_created.json()
    await client.patch(
        f"/api/operations/role-dry-run-sessions/{dry_run_session['session_id']}",
        json={
            "role_key": dry_run_role["key"],
            "item_key": dry_run_item["key"],
            "dry_run_status": "complete",
            "item_note": "Only the first workflow was rehearsed.",
        },
        headers=auth_headers,
    )
    await client.patch(
        f"/api/operations/role-dry-run-sessions/{dry_run_session['session_id']}",
        json={"session_status": "completed"},
        headers=auth_headers,
    )

    browser_checklist = await client.get("/api/operations/browser-qa-checklist", headers=auth_headers)
    browser_item = browser_checklist.json()["items"][0]
    browser_created = await client.post(
        "/api/operations/browser-qa-sessions",
        json={"session_name": "Partial browser QA", "browser": "Chrome"},
        headers=auth_headers,
    )
    browser_session = browser_created.json()
    await client.patch(
        f"/api/operations/browser-qa-sessions/{browser_session['session_id']}",
        json={
            "item_key": browser_item["key"],
            "qa_status": "passed",
            "item_note": "Only the login route was checked.",
        },
        headers=auth_headers,
    )
    await client.patch(
        f"/api/operations/browser-qa-sessions/{browser_session['session_id']}",
        json={"session_status": "completed"},
        headers=auth_headers,
    )

    packet = await client.get("/api/operations/go-live-packet", headers=auth_headers)

    assert packet.status_code == 200
    evidence = {item["key"]: item for item in packet.json()["evidence"]}
    assert evidence["role_dry_run_session"]["status"] == "warning"
    assert evidence["browser_qa_session"]["status"] == "warning"
    assert "pending" in evidence["role_dry_run_session"]["detail"]
    assert "pending" in evidence["browser_qa_session"]["detail"]


@pytest.mark.asyncio
async def test_staff_training_session_evidence_is_audit_backed(client, auth_headers):
    checklist = await client.get("/api/operations/staff-training-checklist", headers=auth_headers)
    first_role = checklist.json()["roles"][0]
    first_item = first_role["items"][0]

    created = await client.post(
        "/api/operations/staff-training-sessions",
        json={"session_name": "Launch staff training", "trainer_name": "Operations Lead", "note": "Pre-live workflow review."},
        headers=auth_headers,
    )
    session = created.json()

    updated = await client.patch(
        f"/api/operations/staff-training-sessions/{session['session_id']}",
        json={
            "role_key": first_role["key"],
            "item_key": first_item["key"],
            "training_status": "signed",
            "item_note": "Front desk reviewed daily workflow and escalation expectations.",
        },
        headers=auth_headers,
    )
    completed = await client.patch(
        f"/api/operations/staff-training-sessions/{session['session_id']}",
        json={"session_status": "completed", "note": "Staff training packet complete."},
        headers=auth_headers,
    )
    sessions = await client.get("/api/operations/staff-training-sessions", headers=auth_headers)
    audit = await client.get(
        "/api/audit?page=1&page_size=5&event_type=operations.staff_training_session",
        headers=auth_headers,
    )

    assert checklist.status_code == 200
    checklist_data = checklist.json()
    role_keys = {role["key"] for role in checklist_data["roles"]}
    assert {"front_desk", "ma_nurse", "provider", "billing", "manager"} <= role_keys
    assert checklist_data["total_roles"] == len(checklist_data["roles"])
    assert all(role["items"] for role in checklist_data["roles"])
    assert all(item["route"] for role in checklist_data["roles"] for item in role["items"])

    assert created.status_code == 201
    assert session["session_name"] == "Launch staff training"
    assert session["trainer_name"] == "Operations Lead"
    assert session["pending_count"] == session["item_count"]

    assert updated.status_code == 200
    updated_data = updated.json()
    assert updated_data["signed_count"] == 1
    updated_item = next(
        item
        for role in updated_data["roles"]
        if role["key"] == first_role["key"]
        for item in role["items"]
        if item["key"] == first_item["key"]
    )
    assert updated_item["training_status"] == "signed"
    assert updated_item["note"] == "Front desk reviewed daily workflow and escalation expectations."

    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"]

    assert sessions.status_code == 200
    assert sessions.json()["total"] == 1
    assert sessions.json()["data"][0]["session_id"] == session["session_id"]

    assert audit.status_code == 200
    assert audit.json()["data"][0]["event_type"] == "operations.staff_training_session"


@pytest.mark.asyncio
async def test_policy_approval_session_evidence_feeds_go_live_packet(client, auth_headers):
    checklist = await client.get("/api/operations/policy-approval-checklist", headers=auth_headers)
    first_item = checklist.json()["items"][0]

    created = await client.post(
        "/api/operations/policy-approval-sessions",
        json={"session_name": "Compliance policy review", "reviewer_name": "Clinic Owner", "note": "Pre-live compliance review."},
        headers=auth_headers,
    )
    session = created.json()

    updated = await client.patch(
        f"/api/operations/policy-approval-sessions/{session['session_id']}",
        json={
            "item_key": first_item["key"],
            "approval_status": "approved",
            "item_note": "Clinic owner approved this policy for launch rehearsal.",
        },
        headers=auth_headers,
    )
    completed = await client.patch(
        f"/api/operations/policy-approval-sessions/{session['session_id']}",
        json={"session_status": "completed", "note": "Policy review completed."},
        headers=auth_headers,
    )
    sessions = await client.get("/api/operations/policy-approval-sessions", headers=auth_headers)
    packet = await client.get("/api/operations/go-live-packet", headers=auth_headers)
    audit = await client.get(
        "/api/audit?page=1&page_size=5&event_type=operations.policy_approval_session",
        headers=auth_headers,
    )

    assert checklist.status_code == 200
    checklist_data = checklist.json()
    item_keys = {item["key"] for item in checklist_data["items"]}
    assert {
        "phi_retention",
        "incident_response",
        "access_review",
        "backup_restore",
        "patient_outreach",
        "assistant_policy",
    } <= item_keys
    assert checklist_data["total"] == len(checklist_data["items"])
    assert all(item["docs"] for item in checklist_data["items"])

    assert created.status_code == 201
    assert session["session_name"] == "Compliance policy review"
    assert session["reviewer_name"] == "Clinic Owner"
    assert session["pending_count"] == session["item_count"]

    assert updated.status_code == 200
    updated_data = updated.json()
    assert updated_data["approved_count"] == 1
    updated_item = next(item for item in updated_data["items"] if item["key"] == first_item["key"])
    assert updated_item["approval_status"] == "approved"
    assert updated_item["note"] == "Clinic owner approved this policy for launch rehearsal."

    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"]

    assert sessions.status_code == 200
    assert sessions.json()["total"] == 1
    assert sessions.json()["data"][0]["session_id"] == session["session_id"]

    assert packet.status_code == 200
    evidence = {item["key"]: item for item in packet.json()["evidence"]}
    assert "policy_approval_session" in evidence
    assert evidence["policy_approval_session"]["status"] in {"warning", "ready"}

    assert audit.status_code == 200
    assert audit.json()["data"][0]["event_type"] == "operations.policy_approval_session"


@pytest.mark.asyncio
async def test_live_use_rehearsal_dashboard_rolls_up_launch_evidence(client, auth_headers):
    dashboard = await client.get("/api/operations/live-use-rehearsal", headers=auth_headers)
    export = await client.get("/api/operations/live-use-rehearsal/export", headers=auth_headers)

    assert dashboard.status_code == 200
    data = dashboard.json()
    assert data["status"] in {"ready", "attention", "blocked"}
    assert data["launch_ready"] is False
    assert data["generated_at"]
    assert data["score"] >= 0
    assert data["summary"]["evidence_ready_count"] >= 0
    assert data["summary"]["evidence_total"] >= 0
    assert data["summary"]["workplan_blockers"] >= 0
    assert data["summary"]["credential_blockers"] >= 0

    gate_keys = {gate["key"] for gate in data["gates"]}
    assert {
        "go_live_packet",
        "production_rehearsal",
        "launch_workplan",
        "credential_preflight",
        "browser_qa",
        "staff_training",
        "policy_approval",
        "role_dry_run",
    } <= gate_keys
    assert all(gate["route"] for gate in data["gates"])
    assert all(gate["status"] in {"ready", "warning", "blocking", "missing"} for gate in data["gates"])

    assert data["next_actions"]
    assert all(action["label"] and action["route"] for action in data["next_actions"])
    assert data["evidence"]
    evidence_keys = {item["key"] for item in data["evidence"]}
    assert {"browser_qa_session", "staff_training_session", "policy_approval_session"} <= evidence_keys

    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert "concierge-os-live-use-rehearsal.csv" in export.headers["content-disposition"]
    assert "section,key,label,status,detail,route" in export.text
    assert "gate,go_live_packet" in export.text


@pytest.mark.asyncio
async def test_cutover_runbook_session_tracks_steps_rollback_and_audit(client, auth_headers):
    checklist = await client.get("/api/operations/cutover-runbook", headers=auth_headers)
    first_phase = checklist.json()["phases"][0]
    first_step = first_phase["steps"][0]

    created = await client.post(
        "/api/operations/cutover-runbook-sessions",
        json={
            "session_name": "Production cutover rehearsal",
            "cutover_owner": "Clinic Manager",
            "scheduled_for": "2026-06-10T08:00:00Z",
            "note": "Dry run before vendor credentials.",
        },
        headers=auth_headers,
    )
    session = created.json()

    updated = await client.patch(
        f"/api/operations/cutover-runbook-sessions/{session['session_id']}",
        json={
            "phase_key": first_phase["key"],
            "step_key": first_step["key"],
            "step_status": "complete",
            "owner_name": "Clinic Manager",
            "step_note": "Confirmed owner and timing.",
        },
        headers=auth_headers,
    )
    rollback = await client.patch(
        f"/api/operations/cutover-runbook-sessions/{session['session_id']}",
        json={
            "rollback_status": "rollback_ready",
            "rollback_decision": "Rollback owner and decision tree reviewed.",
            "session_status": "completed",
        },
        headers=auth_headers,
    )
    sessions = await client.get("/api/operations/cutover-runbook-sessions", headers=auth_headers)
    export = await client.get(f"/api/operations/cutover-runbook-sessions/{session['session_id']}/export", headers=auth_headers)
    packet = await client.get("/api/operations/go-live-packet", headers=auth_headers)
    audit = await client.get(
        "/api/audit?page=1&page_size=5&event_type=operations.cutover_runbook_session",
        headers=auth_headers,
    )

    assert checklist.status_code == 200
    checklist_data = checklist.json()
    phase_keys = {phase["key"] for phase in checklist_data["phases"]}
    assert {"pre_cutover", "cutover_window", "validation", "rollback"} <= phase_keys
    assert checklist_data["total_steps"] == sum(len(phase["steps"]) for phase in checklist_data["phases"])
    assert any(step["rollback_trigger"] for phase in checklist_data["phases"] for step in phase["steps"])

    assert created.status_code == 201
    assert session["session_name"] == "Production cutover rehearsal"
    assert session["cutover_owner"] == "Clinic Manager"
    assert session["pending_count"] == session["step_count"]
    assert session["rollback_status"] == "not_reviewed"

    assert updated.status_code == 200
    updated_data = updated.json()
    assert updated_data["complete_count"] == 1
    updated_step = next(
        step
        for phase in updated_data["phases"]
        if phase["key"] == first_phase["key"]
        for step in phase["steps"]
        if step["key"] == first_step["key"]
    )
    assert updated_step["step_status"] == "complete"
    assert updated_step["owner_name"] == "Clinic Manager"
    assert updated_step["note"] == "Confirmed owner and timing."

    assert rollback.status_code == 200
    assert rollback.json()["status"] == "completed"
    assert rollback.json()["rollback_status"] == "rollback_ready"
    assert rollback.json()["rollback_decision"] == "Rollback owner and decision tree reviewed."

    assert sessions.status_code == 200
    assert sessions.json()["total"] == 1
    assert sessions.json()["data"][0]["session_id"] == session["session_id"]

    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert "concierge-os-cutover-runbook.csv" in export.headers["content-disposition"]
    assert "phase,key,label,status,owner,note,rollback_trigger" in export.text

    assert packet.status_code == 200
    cutover_evidence = next(
        item for item in packet.json()["evidence"]
        if item["key"] == "cutover_runbook_session"
    )
    assert cutover_evidence["status"] == "warning"
    assert "rollback_ready" in cutover_evidence["detail"]

    assert audit.status_code == 200
    assert audit.json()["data"][0]["event_type"] == "operations.cutover_runbook_session"


@pytest.mark.asyncio
async def test_pilot_readiness_score_contract(client, auth_headers):
    readiness = await client.get("/api/analytics/pilot-readiness", headers=auth_headers)
    assert readiness.status_code == 200
    data = readiness.json()
    assert "product_demo_score" in data
    assert "internal_pilot_score" in data
    assert len(data["demo_items"]) > 0
    assert len(data["pilot_items"]) > 0

    seeded = await client.post("/api/analytics/pilot-readiness/seed", headers=auth_headers)
    complete = await client.get("/api/analytics/pilot-readiness", headers=auth_headers)
    assert seeded.status_code == 201
    assert complete.json()["product_demo_score"] == 100
    assert complete.json()["internal_pilot_score"] == 100
    assert complete.json()["product_demo_ready"] is True
    assert complete.json()["internal_pilot_ready"] is True


@pytest.mark.asyncio
async def test_pilot_readiness_seed_requires_admin(client, db: AsyncSession):
    manager = await make_user(db, UserRole.manager, "manager-pilot-seed@clinic.example.com")

    seeded = await client.post(
        "/api/analytics/pilot-readiness/seed",
        headers=headers_for(manager),
    )

    assert seeded.status_code == 403
