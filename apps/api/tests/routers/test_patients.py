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
async def test_patient_document_access_reports_availability(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Access", "last_name": "Document", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    metadata_doc = await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Metadata only",
        "source": "Outside Office",
        "document_type": "Clinical record",
    }, headers=auth_headers)
    file_doc = await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "File backed",
        "source": "Outside Office",
        "document_type": "Clinical record",
        "file_url": "s3://concierge-os/documents/file-backed.pdf",
    }, headers=auth_headers)

    metadata_access = await client.get(
        f"/api/patients/{patient_id}/documents/{metadata_doc.json()['id']}/access?reason=Chart%20review",
        headers=auth_headers,
    )
    file_access = await client.get(
        f"/api/patients/{patient_id}/documents/{file_doc.json()['id']}/access?reason=Chart%20review",
        headers=auth_headers,
    )

    assert metadata_access.status_code == 200
    assert metadata_access.json()["available"] is False
    assert metadata_access.json()["reason"]
    assert file_access.status_code == 200
    assert file_access.json()["available"] is True
    assert file_access.json()["url"] == "s3://concierge-os/documents/file-backed.pdf"
    assert file_access.json()["expires_at"] is not None
    assert file_access.json()["preview_supported"] is True
    assert file_access.json()["content_type"] == "application/pdf"
    assert file_access.json()["viewer_mode"] == "inline"

    audit = await client.get("/api/audit?entity_type=patient_document", headers=auth_headers)
    assert any(event["event_type"] == "patient_document.accessed" for event in audit.json()["data"])

    history = await client.get(f"/api/audit/patients/{patient_id}/access-history", headers=auth_headers)
    assert history.status_code == 200
    assert any(event["event_type"] == "patient_document.accessed" for event in history.json()["data"])


@pytest.mark.asyncio
async def test_patient_document_upload_prepare_returns_signed_target(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Upload", "last_name": "Document", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    res = await client.post(
        f"/api/patients/{patient_id}/documents/upload",
        json={"filename": "outside-lab.pdf", "content_type": "application/pdf"},
        headers=auth_headers,
    )

    assert res.status_code == 200
    data = res.json()
    assert data["method"] == "PUT"
    assert data["file_url"].endswith("outside-lab.pdf")
    assert data["headers"]["Content-Type"] == "application/pdf"


@pytest.mark.asyncio
async def test_patient_document_processing_classifies_and_creates_review_task(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Process", "last_name": "Document", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    document_res = await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Outside CMP lab",
        "source": "Outside Lab",
        "document_type": "Lab result",
        "file_url": "s3://concierge-os/documents/cmp.pdf",
    }, headers=auth_headers)

    processed = await client.post(
        f"/api/patients/{patient_id}/documents/{document_res.json()['id']}/process",
        headers=auth_headers,
    )

    assert processed.status_code == 200
    data = processed.json()
    assert data["document"]["classification"] == "lab_result"
    assert data["document"]["ocr_status"] == "completed"
    assert data["created_task_id"] is not None
    tasks = await client.get(f"/api/tasks?patient_id={patient_id}", headers=auth_headers)
    assert tasks.json()["total"] == 1
    assert tasks.json()["data"][0]["source_type"] == "document_processing"


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


@pytest.mark.asyncio
async def test_patient_encounters_can_be_created_and_signed(client: AsyncClient, auth_headers, admin_user):
    create_res = await client.post("/api/patients", json={
        "first_name": "Encounter", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    encounter_res = await client.post(f"/api/patients/{patient_id}/encounters", json={
        "provider_id": admin_user.id,
        "encounter_type": "annual_wellness",
        "status": "provider_review",
        "summary": "Preventive visit with medication reconciliation.",
        "assessment": "Stable chronic conditions.",
        "plan": "Follow up in 3 months.",
    }, headers=auth_headers)

    assert encounter_res.status_code == 201
    encounter = encounter_res.json()
    assert encounter["status"] == "provider_review"
    assert encounter["provider_name"] == admin_user.display_name

    summary = await client.get(f"/api/patients/{patient_id}/chart-summary", headers=auth_headers)
    assert summary.status_code == 200
    assert summary.json()["checkout_readiness"] == "blocked"
    assert summary.json()["counts"]["unsigned_encounters"] == 1

    sign_res = await client.patch(
        f"/api/patients/{patient_id}/encounters/{encounter['id']}",
        json={"status": "signed"},
        headers=auth_headers,
    )
    assert sign_res.status_code == 200
    assert sign_res.json()["status"] == "signed"
    assert sign_res.json()["signed_at"] is not None

    listed = await client.get(f"/api/patients/{patient_id}/encounters", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    ready = await client.get(f"/api/patients/{patient_id}/chart-summary", headers=auth_headers)
    assert ready.json()["counts"]["unsigned_encounters"] == 0
    assert ready.json()["checkout_readiness"] == "ready"


@pytest.mark.asyncio
async def test_patient_checkout_handoff_collects_unresolved_work(client: AsyncClient, auth_headers, admin_user):
    create_res = await client.post("/api/patients", json={
        "first_name": "Handoff", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Outside record",
        "source": "Outside Office",
        "document_type": "Clinical record",
        "status": "needs_review",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/medications", json={
        "name": "Potassium chloride",
        "status": "held",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/labs", json={
        "panel": "CMP",
        "result": "Potassium 5.9",
        "status": "needs_review",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/care-plan", json={
        "assigned_to_id": admin_user.id,
        "owner_role": "Provider",
        "item": "Review potassium before checkout.",
        "status": "open",
        "escalation": "same_day",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/encounters", json={
        "provider_id": admin_user.id,
        "encounter_type": "office_visit",
        "status": "provider_review",
    }, headers=auth_headers)

    res = await client.get(f"/api/patients/{patient_id}/checkout-handoff", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    assert data["patient"]["id"] == patient_id
    assert data["chart_summary"]["checkout_readiness"] == "blocked"
    assert len(data["documents_needing_review"]) == 1
    assert len(data["medications_needing_review"]) == 1
    assert len(data["labs_needing_review"]) == 1
    assert len(data["care_plan_open_items"]) == 1
    assert data["care_plan_open_items"][0]["assigned_to_name"] == admin_user.display_name
    assert data["care_plan_open_items"][0]["escalation"] == "same_day"
    assert len(data["unsigned_encounters"]) == 1


@pytest.mark.asyncio
async def test_checkout_handoff_item_can_be_converted_to_task(client: AsyncClient, auth_headers, admin_user):
    create_res = await client.post("/api/patients", json={
        "first_name": "Tasked", "last_name": "Handoff", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    care_res = await client.post(f"/api/patients/{patient_id}/care-plan", json={
        "assigned_to_id": admin_user.id,
        "owner_role": "Provider",
        "item": "Resolve checkout blocker before patient leaves.",
        "status": "blocked",
        "escalation": "same_day",
    }, headers=auth_headers)
    source_id = care_res.json()["id"]

    task_res = await client.post(f"/api/patients/{patient_id}/checkout-handoff/tasks", json={
        "source_type": "care_plan",
        "source_id": source_id,
        "priority": "urgent",
    }, headers=auth_headers)
    duplicate_res = await client.post(f"/api/patients/{patient_id}/checkout-handoff/tasks", json={
        "source_type": "care_plan",
        "source_id": source_id,
        "priority": "urgent",
    }, headers=auth_headers)

    assert task_res.status_code == 201
    task = task_res.json()
    assert task["patient_id"] == patient_id
    assert task["assigned_to_id"] == admin_user.id
    assert task["priority"] == "urgent"
    assert task["source_type"] == "checkout_handoff:care_plan"
    assert task["source_id"] == source_id
    assert duplicate_res.status_code == 201
    assert duplicate_res.json()["id"] == task["id"]


@pytest.mark.asyncio
async def test_checkout_workload_groups_open_items_by_owner(client: AsyncClient, auth_headers, admin_user):
    create_res = await client.post("/api/patients", json={
        "first_name": "Workload", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    await client.post(f"/api/patients/{patient_id}/care-plan", json={
        "assigned_to_id": admin_user.id,
        "owner_role": "Provider",
        "item": "Review checkout blocker.",
        "status": "blocked",
        "escalation": "same_day",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/care-plan", json={
        "owner_role": "Front desk",
        "item": "Schedule follow-up.",
        "status": "open",
    }, headers=auth_headers)
    care_task = await client.post(f"/api/patients/{patient_id}/care-plan", json={
        "owner_role": "Provider",
        "item": "Create urgent checkout task.",
        "status": "blocked",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/checkout-handoff/tasks", json={
        "source_type": "care_plan",
        "source_id": care_task.json()["id"],
        "priority": "urgent",
    }, headers=auth_headers)

    res = await client.get("/api/patients/workload/checkout", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    assert data["total_open_items"] == 3
    assert data["unassigned_items"] == 2
    assert data["source_linked_tasks"] == 1
    assert data["urgent_tasks"] == 1
    provider_bucket = next(item for item in data["data"] if item["assigned_to_id"] == admin_user.id)
    assert provider_bucket["assigned_to_name"] == admin_user.display_name
    assert provider_bucket["blocked_items"] == 1
    assert provider_bucket["escalated_items"] == 1
    task_bucket = next(item for item in data["data"] if item["owner_role"] == "Checkout tasks")
    assert task_bucket["source_linked_tasks"] == 1
    assert task_bucket["urgent_tasks"] == 1
