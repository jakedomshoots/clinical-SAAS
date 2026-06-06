import pytest
from types import SimpleNamespace
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services import patient_document_service
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
        "source_contact": "Dr. Priya Rao",
        "source_phone": "555-0101",
        "source_fax": "555-0102",
        "source_reference": "Referral packet NSC-44",
        "requested_by": "Front desk",
        "routed_to_role": "provider",
        "review_priority": "high",
        "summary": "Medication recommendations and follow-up plan.",
    }, headers=auth_headers)

    assert document_res.status_code == 201
    document = document_res.json()
    assert document["patient_id"] == patient_id
    assert document["status"] == "needs_review"
    assert document["source_contact"] == "Dr. Priya Rao"
    assert document["source_phone"] == "555-0101"
    assert document["source_fax"] == "555-0102"
    assert document["source_reference"] == "Referral packet NSC-44"
    assert document["requested_by"] == "Front desk"
    assert document["routed_to_role"] == "provider"
    assert document["review_priority"] == "high"

    list_res = await client.get(f"/api/patients/{patient_id}/documents", headers=auth_headers)
    assert list_res.status_code == 200
    listed = list_res.json()
    assert listed["total"] == 1
    assert listed["data"][0]["title"] == "Outside cardiology note"
    assert listed["data"][0]["source_contact"] == "Dr. Priya Rao"

    update_res = await client.patch(
        f"/api/patients/{patient_id}/documents/{document['id']}",
        json={"status": "filed", "review_note": "Reviewed by provider; no medication change.", "reviewed_by": "Dr. Chen"},
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["status"] == "filed"
    assert updated["review_note"] == "Reviewed by provider; no medication change."
    assert updated["reviewed_by"] == "Dr. Chen"
    assert updated["reviewed_at"]


@pytest.mark.asyncio
async def test_patient_document_review_queue_is_org_scoped_and_patient_labeled(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    patient_res = await client.post("/api/patients", json={
        "first_name": "Queue", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown", "phone": "555-1000",
    }, headers=auth_headers)
    patient_id = patient_res.json()["id"]
    other_patient_res = await client.post("/api/patients", json={
        "first_name": "Filed", "last_name": "Patient", "dob": "1981-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    other_patient_id = other_patient_res.json()["id"]
    await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Incoming orthopedic note",
        "source": "Ortho Partners",
        "document_type": "Consult note",
        "status": "needs_review",
        "source_contact": "Records desk",
        "source_phone": "555-2000",
        "source_reference": "ORTHO-22",
        "routed_to_role": "ma_nurse",
        "review_priority": "high",
        "summary": "Outside note needs medication reconciliation.",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Normal front desk packet",
        "source": "Front Office",
        "document_type": "Insurance",
        "status": "needs_review",
        "routed_to_role": "front_desk",
        "review_priority": "normal",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{other_patient_id}/documents", json={
        "title": "Already filed note",
        "source": "Filed Office",
        "document_type": "Referral",
        "status": "filed",
    }, headers=auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-doc-queue@clinic.example.com",
        organization_id="other-org",
    )
    other_patient = await client.post("/api/patients", json={
        "first_name": "Other", "last_name": "Org", "dob": "1970-01-01", "gender": "Unknown",
    }, headers=headers_for(other_user))
    await client.post(f"/api/patients/{other_patient.json()['id']}/documents", json={
        "title": "Other org note",
        "source": "Hidden Office",
        "document_type": "Consult note",
        "status": "needs_review",
    }, headers=headers_for(other_user))

    queue_res = await client.get("/api/patients/documents/review-queue?status=needs_review", headers=auth_headers)

    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert queue["total"] == 2
    item = next(entry for entry in queue["data"] if entry["title"] == "Incoming orthopedic note")
    assert item["title"] == "Incoming orthopedic note"
    assert item["patient_id"] == patient_id
    assert item["patient_name"] == "Queue Patient"
    assert item["patient_mrn"].startswith("MRN-")
    assert item["patient_phone"] == "555-1000"
    assert item["source_contact"] == "Records desk"
    assert item["source_phone"] == "555-2000"
    assert item["source_reference"] == "ORTHO-22"
    assert item["routed_to_role"] == "ma_nurse"
    assert item["review_priority"] == "high"

    filtered_res = await client.get(
        "/api/patients/documents/review-queue?status=needs_review&routed_to_role=ma_nurse&review_priority=high",
        headers=auth_headers,
    )
    assert filtered_res.status_code == 200
    filtered = filtered_res.json()
    assert filtered["total"] == 1
    assert filtered["data"][0]["title"] == "Incoming orthopedic note"


@pytest.mark.asyncio
async def test_patient_document_upload_can_be_confirmed(client: AsyncClient, auth_headers):
    create_res = await client.post("/api/patients", json={
        "first_name": "Upload", "last_name": "Patient", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    prepared = await client.post(
        f"/api/patients/{patient_id}/documents/upload",
        json={"filename": "outside-note.pdf", "content_type": "application/pdf"},
        headers=auth_headers,
    )
    assert prepared.status_code == 200

    confirmed = await client.post(
        f"/api/patients/{patient_id}/documents/upload/confirm",
        json={
            "title": "Outside note",
            "source": "Outside Office",
            "document_type": "Consult note",
            "file_url": prepared.json()["file_url"],
            "filename": "outside-note.pdf",
            "content_type": "application/pdf",
            "checksum": "demo-checksum",
            "pages": 3,
            "upload_token": prepared.json()["upload_token"],
        },
        headers=auth_headers,
    )
    assert confirmed.status_code == 201
    assert confirmed.json()["upload_status"] == "uploaded"
    assert confirmed.json()["ocr_status"] == "queued"
    assert confirmed.json()["matched_by"] == "upload confirmation"

    duplicate = await client.post(
        f"/api/patients/{patient_id}/documents/upload/confirm",
        json={
            "title": "Outside note duplicate",
            "source": "Outside Office",
            "document_type": "Consult note",
            "file_url": prepared.json()["file_url"],
            "filename": "outside-note.pdf",
            "content_type": "application/pdf",
            "checksum": "demo-checksum",
            "pages": 3,
            "upload_token": prepared.json()["upload_token"],
        },
        headers=auth_headers,
    )
    assert duplicate.status_code == 201
    assert duplicate.json()["id"] == confirmed.json()["id"]


@pytest.mark.asyncio
async def test_patient_document_upload_verification_rejects_content_type_mismatch(
    client: AsyncClient,
    auth_headers,
    monkeypatch,
):
    create_res = await client.post("/api/patients", json={
        "first_name": "Verify", "last_name": "Upload", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    prepared = await client.post(
        f"/api/patients/{patient_id}/documents/upload",
        json={"filename": "outside-note.pdf", "content_type": "application/pdf"},
        headers=auth_headers,
    )
    monkeypatch.setattr(patient_document_service.settings, "document_upload_verification_required", True)
    monkeypatch.setattr(
        patient_document_service.minio,
        "stat_object",
        lambda bucket, object_key: SimpleNamespace(content_type="text/plain", metadata={"checksum": "demo-checksum"}),
    )

    confirmed = await client.post(
        f"/api/patients/{patient_id}/documents/upload/confirm",
        json={
            "title": "Outside note",
            "source": "Outside Office",
            "document_type": "Consult note",
            "file_url": prepared.json()["file_url"],
            "filename": "outside-note.pdf",
            "content_type": "application/pdf",
            "checksum": "demo-checksum",
            "upload_token": prepared.json()["upload_token"],
        },
        headers=auth_headers,
    )

    assert confirmed.status_code == 400
    assert "content type" in confirmed.json()["detail"].lower()


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
        "file_url": f"s3://concierge-os/patients/{patient_id}/documents/file-backed.pdf",
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
    assert file_access.json()["url"].startswith(
        f"/api/patients/{patient_id}/documents/{file_doc.json()['id']}/download?token="
    )
    assert file_access.json()["access_token"]
    assert file_access.json()["expires_at"] is not None
    assert file_access.json()["preview_supported"] is True
    assert file_access.json()["content_type"] == "application/pdf"
    assert file_access.json()["viewer_mode"] == "inline"
    assert file_access.json()["storage_status"] == "signed_handoff"
    assert file_access.json()["file_name"] == "file-backed.pdf"
    assert file_access.json()["source_uri_preview"] == "s3://concierge-os/.../file-backed.pdf"

    unauthenticated_handoff = await client.get(file_access.json()["url"])
    handoff = await client.get(file_access.json()["url"], headers=auth_headers)
    invalid_handoff = await client.get(
        f"/api/patients/{patient_id}/documents/{file_doc.json()['id']}/download?token=bad",
        headers=auth_headers,
    )
    assert unauthenticated_handoff.status_code in {401, 403}
    assert handoff.status_code == 200
    assert handoff.json()["file_name"] == "file-backed.pdf"
    assert handoff.json()["storage_status"] == "signed_handoff"
    assert handoff.json()["presigned_url"] is None
    assert handoff.json()["expires_at"] == file_access.json()["expires_at"]
    assert invalid_handoff.status_code == 404

    readiness = await client.get("/api/operations/document-storage-readiness", headers=auth_headers)
    assert readiness.status_code == 200
    recent_handoff = next(
        item
        for item in readiness.json()["recent_handoffs"]
        if item["document_id"] == file_doc.json()["id"]
    )
    assert recent_handoff["expires_at"] is not None
    assert recent_handoff["expired"] is False

    audit = await client.get("/api/audit?entity_type=patient_document", headers=auth_headers)
    assert any(event["event_type"] == "patient_document.accessed" for event in audit.json()["data"])
    assert any(event["event_type"] == "patient_document.download_handoff" for event in audit.json()["data"])

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
    assert data["upload_url"] == data["file_url"]
    assert data["file_url"].endswith("outside-lab.pdf")
    assert data["upload_token"]
    assert data["headers"]["Content-Type"] == "application/pdf"


@pytest.mark.asyncio
async def test_patient_document_handoffs_include_presigned_urls_when_signer_is_available(
    client: AsyncClient,
    auth_headers,
    monkeypatch,
):
    monkeypatch.setattr(
        patient_document_service,
        "_presigned_put_url",
        lambda file_url, patient_id: f"https://storage.example.test/upload?target={file_url}",
    )
    monkeypatch.setattr(
        patient_document_service,
        "_presigned_get_url",
        lambda file_url, patient_id: f"https://storage.example.test/download?target={file_url}&X-Amz-Signature=test",
    )
    create_res = await client.post("/api/patients", json={
        "first_name": "Signed", "last_name": "Document", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    prepared = await client.post(
        f"/api/patients/{patient_id}/documents/upload",
        json={"filename": "signed-note.pdf", "content_type": "application/pdf"},
        headers=auth_headers,
    )
    assert prepared.status_code == 200
    assert prepared.json()["upload_url"].startswith("https://storage.example.test/upload?")

    file_doc = await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Signed file backed",
        "source": "Outside Office",
        "document_type": "Clinical record",
        "file_url": f"s3://concierge-os/patients/{patient_id}/documents/signed-file-backed.pdf",
    }, headers=auth_headers)
    file_access = await client.get(
        f"/api/patients/{patient_id}/documents/{file_doc.json()['id']}/access?reason=Chart%20review",
        headers=auth_headers,
    )
    handoff = await client.get(file_access.json()["url"], headers=auth_headers)

    assert handoff.status_code == 200
    assert handoff.json()["presigned_url"].startswith("https://storage.example.test/download?")
    assert "X-Amz-Signature=test" in handoff.json()["presigned_url"]
    assert handoff.json()["message"] == "Signed object-storage access is ready."


@pytest.mark.asyncio
async def test_patient_document_upload_confirm_rejects_unprepared_target(
    client: AsyncClient,
    auth_headers,
):
    create_res = await client.post("/api/patients", json={
        "first_name": "Upload", "last_name": "Guard", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    prepared = await client.post(
        f"/api/patients/{patient_id}/documents/upload",
        json={"filename": "outside-note.pdf", "content_type": "application/pdf"},
        headers=auth_headers,
    )
    assert prepared.status_code == 200

    confirmed = await client.post(
        f"/api/patients/{patient_id}/documents/upload/confirm",
        json={
            "title": "Outside note",
            "source": "Outside Office",
            "document_type": "Consult note",
            "file_url": f"{prepared.json()['file_url']}.tampered",
            "filename": "outside-note.pdf",
            "content_type": "application/pdf",
            "checksum": "demo-checksum",
            "pages": 3,
            "upload_token": prepared.json()["upload_token"],
        },
        headers=auth_headers,
    )

    assert confirmed.status_code == 400


@pytest.mark.asyncio
async def test_patient_document_create_and_update_reject_unscoped_file_urls(
    client: AsyncClient,
    auth_headers,
):
    create_res = await client.post("/api/patients", json={
        "first_name": "Storage", "last_name": "Guard", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]

    unsafe_create = await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Unsafe file backed",
        "source": "Outside Office",
        "document_type": "Clinical record",
        "file_url": "s3://concierge-os/other-patient/file.pdf",
    }, headers=auth_headers)
    safe_doc = await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Safe metadata",
        "source": "Outside Office",
        "document_type": "Clinical record",
    }, headers=auth_headers)
    unsafe_update = await client.patch(
        f"/api/patients/{patient_id}/documents/{safe_doc.json()['id']}",
        json={"file_url": "s3://concierge-os/patients/other/documents/file.pdf"},
        headers=auth_headers,
    )

    assert unsafe_create.status_code == 400
    assert unsafe_update.status_code == 400


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
        "file_url": f"s3://concierge-os/patients/{patient_id}/documents/cmp.pdf",
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
async def test_patient_chart_summary_blocks_checkout_for_unresolved_clinical_items(
    client: AsyncClient,
    auth_headers,
):
    create_res = await client.post("/api/patients", json={
        "first_name": "Safety", "last_name": "Closeout", "dob": "1990-01-01", "gender": "Unknown",
    }, headers=auth_headers)
    patient_id = create_res.json()["id"]
    await client.post(f"/api/patients/{patient_id}/medications", json={
        "name": "Warfarin",
        "dose": "5 mg",
        "directions": "Daily",
        "source": "Outside med list",
        "status": "review",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/labs", json={
        "collected_at": "2026-06-03T08:00:00",
        "panel": "INR",
        "result": "INR 5.2",
        "flag": "Critical",
        "status": "needs_review",
        "source": "Outside Lab",
    }, headers=auth_headers)
    await client.post(f"/api/patients/{patient_id}/care-plan", json={
        "owner_role": "Provider",
        "item": "Adjust anticoagulation plan before checkout.",
        "due": "Today",
        "status": "blocked",
        "escalation": "Provider",
    }, headers=auth_headers)

    summary = await client.get(f"/api/patients/{patient_id}/chart-summary", headers=auth_headers)

    assert summary.status_code == 200
    data = summary.json()
    assert data["checkout_readiness"] == "blocked"
    assert data["counts"]["medications_needing_review"] == 1
    assert data["counts"]["labs_needing_review"] == 1
    assert data["counts"]["care_plan_blockers"] == 1
    assert "1 medication needs reconciliation" in data["blockers"]
    assert "1 lab result needs review" in data["blockers"]
    assert "1 care plan item is blocked" in data["blockers"]


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
