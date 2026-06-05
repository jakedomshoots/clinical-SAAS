from datetime import date, datetime, timedelta

import pytest


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

    submitted = await client.post(f"/api/billing/cases/{billing.json()['id']}/submit", headers=auth_headers)
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"

    denied = await client.post(f"/api/billing/cases/{billing.json()['id']}/deny", json={"notes": "Payer requested documentation"}, headers=auth_headers)
    assert denied.status_code == 200
    assert denied.json()["status"] == "denied"

    paid = await client.post(f"/api/billing/cases/{billing.json()['id']}/payment", headers=auth_headers)
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"

    case_timeline = await client.get(f"/api/billing/cases/{billing.json()['id']}/timeline", headers=auth_headers)
    assert case_timeline.status_code == 200
    assert case_timeline.json()["total"] >= 3
    assert any(event["source"] == "integration" and event["status"] == "pending" for event in case_timeline.json()["data"])

    eligibility = await client.post(f"/api/billing/eligibility/{patient_id}", headers=auth_headers)
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
async def test_security_templates_and_integration_capabilities(client, auth_headers):
    policy = await client.get("/api/auth/session-policy", headers=auth_headers)
    templates = await client.get("/api/clinical/encounter-templates", headers=auth_headers)
    capabilities = await client.get("/api/integration-capabilities", headers=auth_headers)

    assert policy.status_code == 200
    assert policy.json()["access_token_expire_minutes"] > 0
    assert templates.json()["total"] >= 2
    assert "fhir_placeholder" in capabilities.json()["ehr"]["supports"]


@pytest.mark.asyncio
async def test_pilot_readiness_score_contract(client, auth_headers):
    readiness = await client.get("/api/analytics/pilot-readiness", headers=auth_headers)
    assert readiness.status_code == 200
    data = readiness.json()
    assert "product_demo_score" in data
    assert "internal_pilot_score" in data
    assert len(data["demo_items"]) > 0
    assert len(data["pilot_items"]) > 0
