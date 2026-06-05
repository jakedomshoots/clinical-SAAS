import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_create_patient(client: AsyncClient, auth_headers):
    res = await client.post("/api/patients", json={
        "first_name": "John",
        "last_name": "Doe",
        "dob": "1980-05-15",
        "gender": "Male",
        "phone": "555-0100",
        "email": "john@example.com",
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["mrn"].startswith("MRN-")
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_patients(client: AsyncClient, auth_headers):
    await client.post("/api/patients", json={
        "first_name": "Alice", "last_name": "Smith", "dob": "1990-01-01", "gender": "Female",
    }, headers=auth_headers)
    await client.post("/api/patients", json={
        "first_name": "Bob", "last_name": "Jones", "dob": "1985-06-15", "gender": "Male",
    }, headers=auth_headers)

    res = await client.get("/api/patients", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert len(data["data"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 20


@pytest.mark.asyncio
async def test_get_patient(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Jane", "last_name": "Doe", "dob": "1982-03-20", "gender": "Female",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    res = await client.get(f"/api/patients/{patient_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["first_name"] == "Jane"


@pytest.mark.asyncio
async def test_update_patient(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Old", "last_name": "Name", "dob": "1970-01-01", "gender": "Other",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    res = await client.patch(f"/api/patients/{patient_id}", json={
        "first_name": "New",
        "phone": "555-9999",
    }, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["first_name"] == "New"
    assert data["phone"] == "555-9999"
    assert data["last_name"] == "Name"


@pytest.mark.asyncio
async def test_deactivate_patient(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Delete", "last_name": "Me", "dob": "1950-12-25", "gender": "Male",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    res = await client.delete(f"/api/patients/{patient_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["is_active"] is False


@pytest.mark.asyncio
async def test_search_patients(client: AsyncClient, auth_headers):
    await client.post("/api/patients", json={
        "first_name": "Searchable", "last_name": "Person", "dob": "1995-07-07", "gender": "Female",
    }, headers=auth_headers)
    await client.post("/api/patients", json={
        "first_name": "Other", "last_name": "Guy", "dob": "1995-08-08", "gender": "Male",
    }, headers=auth_headers)

    res = await client.get("/api/patients?search=Searchable", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["data"][0]["first_name"] == "Searchable"


@pytest.mark.asyncio
async def test_patient_not_found(client: AsyncClient, auth_headers):
    res = await client.get(
        "/api/patients/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_patient_requires_auth(client: AsyncClient):
    res = await client.get("/api/patients")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_patient_with_allergies(client: AsyncClient, auth_headers):
    res = await client.post("/api/patients", json={
        "first_name": "Allergic",
        "last_name": "Patient",
        "dob": "1988-03-15",
        "gender": "Female",
        "allergies": [
            {"substance": "Penicillin", "reaction": "Rash", "severity": "moderate"},
            {"substance": "Peanuts", "reaction": "Anaphylaxis", "severity": "severe"},
        ],
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert len(data["allergies"]) == 2
    assert data["allergies"][0]["substance"] == "Penicillin"


@pytest.mark.asyncio
async def test_patient_list_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    await client.post("/api/patients", json={
        "first_name": "Scoped", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get("/api/patients", headers=headers_for(other_user))

    assert res.status_code == 200
    assert res.json()["total"] == 0


@pytest.mark.asyncio
async def test_patient_get_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    create_res = await client.post("/api/patients", json={
        "first_name": "Hidden", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-get-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get(f"/api/patients/{patient_id}", headers=headers_for(other_user))

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_patient_documents_can_be_created_listed_and_updated(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Document", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    document_res = await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Outside cardiology note",
        "source": "North Shore Cardiology",
        "document_type": "Consult note",
        "status": "needs_review",
        "matched_by": "manual",
        "pages": 6,
        "summary": "Medication recommendations and follow-up plan.",
    }, headers=auth_headers)

    assert document_res.status_code == 201
    document = document_res.json()
    assert document["patient_id"] == patient_id
    assert document["status"] == "needs_review"

    list_res = await client.get(f"/api/patients/{patient_id}/documents", headers=auth_headers)
    assert list_res.status_code == 200
    listed = list_res.json()
    assert listed["total"] == 1
    assert listed["data"][0]["title"] == "Outside cardiology note"

    update_res = await client.patch(
        f"/api/patients/{patient_id}/documents/{document['id']}",
        json={"status": "filed"},
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "filed"


@pytest.mark.asyncio
async def test_patient_documents_are_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    create_res = await client.post("/api/patients", json={
        "first_name": "Hidden", "last_name": "Document", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    document_res = await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Protected outside record",
        "source": "Outside Office",
        "document_type": "Clinical record",
    }, headers=auth_headers)
    document_id = document_res.json()["id"]
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-document-admin@clinic.example.com",
        organization_id="other-org",
    )
    other_headers = headers_for(other_user)

    list_res = await client.get(f"/api/patients/{patient_id}/documents", headers=other_headers)
    update_res = await client.patch(
        f"/api/patients/{patient_id}/documents/{document_id}",
        json={"status": "filed"},
        headers=other_headers,
    )

    assert list_res.status_code == 404
    assert update_res.status_code == 404


@pytest.mark.asyncio
async def test_patient_chart_summary_reports_checkout_blockers(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Checkout", "last_name": "Ready", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Critical outside lab",
        "source": "Outside Lab",
        "document_type": "Lab result",
        "status": "needs_review",
        "pages": 2,
    }, headers=auth_headers)
    await client.post("/api/tasks", json={
        "title": "Call patient before checkout",
        "priority": "urgent",
        "patient_id": patient_id,
    }, headers=auth_headers)

    res = await client.get(f"/api/patients/{patient_id}/chart-summary", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == patient_id
    assert data["checkout_readiness"] == "blocked"
    assert data["counts"]["documents_needing_review"] == 1
    assert data["counts"]["urgent_tasks"] == 1
    assert data["documents"][0]["title"] == "Critical outside lab"
    assert data["open_tasks"][0]["title"] == "Call patient before checkout"


@pytest.mark.asyncio
async def test_patient_chart_summary_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    create_res = await client.post("/api/patients", json={
        "first_name": "Private", "last_name": "Summary", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-summary-admin@clinic.example.com",
        organization_id="other-org",
    )

    res = await client.get(f"/api/patients/{patient_id}/chart-summary", headers=headers_for(other_user))

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_patient_medications_and_care_plan_are_persisted(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Clinical", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    med_res = await client.post(f"/api/patients/{patient_id}/medications", json={
        "name": "Metformin ER",
        "dose": "500 mg",
        "directions": "2 tablets with dinner",
        "source": "Active med list",
        "status": "review",
    }, headers=auth_headers)
    care_res = await client.post(f"/api/patients/{patient_id}/care-plan", json={
        "owner_role": "Provider",
        "item": "Review medication list before checkout.",
        "due": "Today",
        "status": "open",
    }, headers=auth_headers)

    assert med_res.status_code == 201
    assert care_res.status_code == 201
    med_id = med_res.json()["id"]
    care_id = care_res.json()["id"]

    meds = await client.get(f"/api/patients/{patient_id}/medications", headers=auth_headers)
    care_plan = await client.get(f"/api/patients/{patient_id}/care-plan", headers=auth_headers)
    assert meds.status_code == 200
    assert meds.json()["data"][0]["name"] == "Metformin ER"
    assert care_plan.status_code == 200
    assert care_plan.json()["data"][0]["owner_role"] == "Provider"

    med_update = await client.patch(
        f"/api/patients/{patient_id}/medications/{med_id}",
        json={"status": "active"},
        headers=auth_headers,
    )
    care_update = await client.patch(
        f"/api/patients/{patient_id}/care-plan/{care_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )
    assert med_update.status_code == 200
    assert med_update.json()["status"] == "active"
    assert care_update.status_code == 200
    assert care_update.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_patient_labs_are_persisted_and_reviewable(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Lab", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    lab_res = await client.post(f"/api/patients/{patient_id}/labs", json={
        "collected_at": "2026-06-03T08:00:00",
        "panel": "CMP",
        "result": "Potassium 5.9 mmol/L",
        "flag": "Critical",
        "status": "needs_review",
        "source": "Outside Lab",
    }, headers=auth_headers)

    assert lab_res.status_code == 201
    lab = lab_res.json()
    assert lab["status"] == "needs_review"

    listed = await client.get(f"/api/patients/{patient_id}/labs", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["panel"] == "CMP"

    updated = await client.patch(
        f"/api/patients/{patient_id}/labs/{lab['id']}",
        json={"status": "reviewed"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "reviewed"
