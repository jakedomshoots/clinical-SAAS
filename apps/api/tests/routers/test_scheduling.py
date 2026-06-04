from datetime import date, datetime, timedelta

import pytest
from httpx import AsyncClient


async def create_patient(client: AsyncClient, auth_headers) -> str:
    res = await client.post(
        "/api/patients",
        json={
            "first_name": "Schedule",
            "last_name": "Patient",
            "dob": date(1975, 5, 5).isoformat(),
            "gender": "Unknown",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_create_list_and_update_appointment(client: AsyncClient, auth_headers, admin_user):
    patient_id = await create_patient(client, auth_headers)
    start = datetime(2026, 6, 5, 14, 0)
    end = start + timedelta(minutes=30)

    res = await client.post(
        "/api/schedule/appointments",
        json={
            "patient_id": patient_id,
            "provider_id": admin_user.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "type": "follow_up",
            "notes": "Bring medication list.",
        },
        headers=auth_headers,
    )

    assert res.status_code == 201
    appointment = res.json()
    assert appointment["status"] == "scheduled"
    assert appointment["patient_id"] == patient_id

    listed = await client.get(
        f"/api/schedule/appointments?start_date={start.date().isoformat()}&end_date=2026-06-06",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    updated = await client.patch(
        f"/api/schedule/appointments/{appointment['id']}",
        json={"status": "checked_in"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "checked_in"


@pytest.mark.asyncio
async def test_set_and_get_provider_availability(client: AsyncClient, auth_headers, admin_user):
    res = await client.post(
        "/api/schedule/availability",
        json={
            "provider_id": admin_user.id,
            "day_of_week": 1,
            "start_time": "09:00",
            "end_time": "17:00",
        },
        headers=auth_headers,
    )

    assert res.status_code == 201
    availability = res.json()
    assert availability["provider_id"] == admin_user.id

    listed = await client.get(f"/api/schedule/availability/{admin_user.id}", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["start_time"] == "09:00"
