from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fax import Fax, FaxDirection, FaxStatus
from app.models.user import UserRole
from tests.conftest import headers_for, make_user


async def create_patient(client: AsyncClient, auth_headers) -> str:
    res = await client.post(
        "/api/patients",
        json={
            "first_name": "Fax",
            "last_name": "Patient",
            "dob": date(1980, 1, 1).isoformat(),
            "gender": "Unknown",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_send_and_list_outbound_faxes(client: AsyncClient, auth_headers):
    patient_id = await create_patient(client, auth_headers)

    res = await client.post(
        "/api/faxes/send",
        json={"to_number": "+13125550100", "patient_id": patient_id},
        headers=auth_headers,
    )

    assert res.status_code == 201
    fax = res.json()
    assert fax["direction"] == "outbound"
    assert fax["status"] == "pending"
    assert fax["patient_id"] == patient_id

    res = await client.get("/api/faxes?direction=outbound", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["data"][0]["id"] == fax["id"]


@pytest.mark.asyncio
async def test_match_inbound_fax_to_patient(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    patient_id = await create_patient(client, auth_headers)
    inbound = Fax(
        direction=FaxDirection.inbound,
        status=FaxStatus.received,
        from_number="+13125550111",
        to_number="+13125550999",
        pages=3,
        file_url="s3://concierge-os/faxes/inbound-referral.pdf",
        ocr_text="Referral packet awaiting chart match.",
    )
    db.add(inbound)
    await db.commit()
    await db.refresh(inbound)

    res = await client.post(
        f"/api/faxes/{inbound.id}/match",
        json={"patient_id": patient_id},
        headers=auth_headers,
    )

    assert res.status_code == 200
    fax = res.json()
    assert fax["patient_id"] == patient_id
    assert fax["matched_by"] == "manual"

    audit = await client.get("/api/audit?entity_type=fax", headers=auth_headers)
    assert audit.status_code == 200
    assert any(event["event_type"] == "fax.matched" for event in audit.json()["data"])

    documents = await client.get(f"/api/patients/{patient_id}/documents", headers=auth_headers)
    assert documents.status_code == 200
    assert documents.json()["total"] == 1
    assert documents.json()["data"][0]["file_url"] == "s3://concierge-os/faxes/inbound-referral.pdf"
    assert documents.json()["data"][0]["status"] == "needs_review"


@pytest.mark.asyncio
async def test_fax_list_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    inbound = Fax(
        organization_id="other-org",
        direction=FaxDirection.inbound,
        status=FaxStatus.received,
        from_number="+13125550122",
        to_number="+13125550999",
        pages=1,
    )
    db.add(inbound)
    await db.commit()
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-fax-list@clinic.example.com",
        organization_id="other-org",
    )

    default_res = await client.get("/api/faxes", headers=auth_headers)
    other_res = await client.get("/api/faxes", headers=headers_for(other_user))

    assert default_res.status_code == 200
    assert default_res.json()["total"] == 0
    assert other_res.status_code == 200
    assert other_res.json()["total"] == 1


@pytest.mark.asyncio
async def test_fax_get_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    inbound = Fax(
        organization_id="other-org",
        direction=FaxDirection.inbound,
        status=FaxStatus.received,
        from_number="+13125550133",
        to_number="+13125550999",
        pages=1,
    )
    db.add(inbound)
    await db.commit()
    await db.refresh(inbound)

    res = await client.get(f"/api/faxes/{inbound.id}", headers=auth_headers)

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_fax_match_rejects_cross_org_patient(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    inbound = Fax(
        direction=FaxDirection.inbound,
        status=FaxStatus.received,
        from_number="+13125550144",
        to_number="+13125550999",
        pages=1,
    )
    db.add(inbound)
    await db.commit()
    await db.refresh(inbound)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-fax-patient@clinic.example.com",
        organization_id="other-org",
    )
    patient_id = await create_patient(client, headers_for(other_user))

    res = await client.post(
        f"/api/faxes/{inbound.id}/match",
        json={"patient_id": patient_id},
        headers=auth_headers,
    )

    assert res.status_code == 404
