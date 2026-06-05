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
