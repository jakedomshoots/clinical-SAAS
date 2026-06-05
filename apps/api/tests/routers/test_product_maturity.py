from datetime import date

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
async def test_security_templates_and_integration_capabilities(client, auth_headers):
    policy = await client.get("/api/auth/session-policy", headers=auth_headers)
    templates = await client.get("/api/clinical/encounter-templates", headers=auth_headers)
    capabilities = await client.get("/api/integration-capabilities", headers=auth_headers)

    assert policy.status_code == 200
    assert policy.json()["access_token_expire_minutes"] > 0
    assert templates.json()["total"] >= 2
    assert "fhir_placeholder" in capabilities.json()["ehr"]["supports"]
