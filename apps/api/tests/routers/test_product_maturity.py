from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration_event import IntegrationEvent, IntegrationEventStatus
from app.models.user import UserRole
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
async def test_launch_workplan_snapshot_and_export(client, auth_headers):
    snapshot = await client.post("/api/operations/launch-workplan/snapshots", headers=auth_headers)
    snapshots = await client.get("/api/operations/launch-workplan/snapshots", headers=auth_headers)
    exported = await client.get("/api/operations/launch-workplan/export", headers=auth_headers)

    assert snapshot.status_code == 201
    snapshot_data = snapshot.json()
    assert snapshot_data["total"] >= snapshot_data["blocking_count"]
    assert snapshot_data["unassigned_count"] >= 0

    assert snapshots.status_code == 200
    assert snapshots.json()["total"] == 1
    assert snapshots.json()["data"][0]["id"] == snapshot_data["id"]

    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    assert "key,source,category,label,severity,detail,route,owner_role,recommended_action,owner,assignment_status,due_date,note" in exported.text


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
    assert data["evidence_ready_count"] >= 2
    evidence_keys = {item["key"] for item in data["evidence"]}
    assert {"readiness_snapshot", "launch_workplan_snapshot", "production_rehearsal_snapshot", "credential_preflight", "backup_restore"} <= evidence_keys
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
