from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fax import Fax, FaxDirection, FaxStatus


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
