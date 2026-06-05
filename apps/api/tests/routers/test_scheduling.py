from datetime import date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from tests.conftest import headers_for, make_user


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

    for lifecycle_status in ["roomed", "provider_review", "checkout", "completed"]:
        updated = await client.patch(
            f"/api/schedule/appointments/{appointment['id']}",
            json={"status": lifecycle_status},
            headers=auth_headers,
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == lifecycle_status


@pytest.mark.asyncio
async def test_today_queue_reports_blocked_patient(client: AsyncClient, auth_headers, admin_user):
    patient_id = await create_patient(client, auth_headers)
    start = datetime(2026, 6, 5, 9, 0)
    end = start + timedelta(minutes=30)
    await client.post(
        "/api/schedule/appointments",
        json={
            "patient_id": patient_id,
            "provider_id": admin_user.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "type": "annual_wellness",
        },
        headers=auth_headers,
    )
    await client.post(f"/api/patients/{patient_id}/documents", json={
        "title": "Outside lab",
        "source": "Outside Lab",
        "document_type": "Lab result",
        "status": "needs_review",
    }, headers=auth_headers)

    res = await client.get(
        "/api/schedule/today-queue?start_date=2026-06-05&end_date=2026-06-06",
        headers=auth_headers,
    )

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["blocked"] == 1
    assert data["data"][0]["checkout_readiness"] == "blocked"
    assert data["data"][0]["documents_needing_review"] == 1

    appointment_id = data["data"][0]["appointment"]["id"]
    await client.patch(
        f"/api/schedule/appointments/{appointment_id}",
        json={"status": "roomed"},
        headers=auth_headers,
    )
    active = await client.get(
        "/api/schedule/today-queue?start_date=2026-06-05&end_date=2026-06-06",
        headers=auth_headers,
    )
    assert active.json()["checked_in"] == 1


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


@pytest.mark.asyncio
async def test_appointments_are_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-schedule-admin@clinic.example.com",
        organization_id="other-org",
    )
    other_headers = headers_for(other_user)
    patient_id = await create_patient(client, other_headers)
    start = datetime(2026, 6, 5, 16, 0)
    end = start + timedelta(minutes=30)
    created = await client.post(
        "/api/schedule/appointments",
        json={
            "patient_id": patient_id,
            "provider_id": other_user.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        },
        headers=other_headers,
    )
    appointment_id = created.json()["id"]

    listed = await client.get(
        f"/api/schedule/appointments?start_date={start.date().isoformat()}&end_date=2026-06-06",
        headers=auth_headers,
    )
    fetched = await client.get(
        f"/api/schedule/appointments/{appointment_id}",
        headers=auth_headers,
    )

    assert listed.status_code == 200
    assert listed.json()["total"] == 0
    assert fetched.status_code == 404


@pytest.mark.asyncio
async def test_create_appointment_rejects_cross_org_provider(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    patient_id = await create_patient(client, auth_headers)
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-schedule-provider@clinic.example.com",
        organization_id="other-org",
    )
    start = datetime(2026, 6, 5, 17, 0)
    end = start + timedelta(minutes=30)

    res = await client.post(
        "/api/schedule/appointments",
        json={
            "patient_id": patient_id,
            "provider_id": other_user.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        },
        headers=auth_headers,
    )

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_availability_is_scoped_to_user_organization(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-availability-admin@clinic.example.com",
        organization_id="other-org",
    )
    other_headers = headers_for(other_user)
    created = await client.post(
        "/api/schedule/availability",
        json={
            "provider_id": other_user.id,
            "day_of_week": 2,
            "start_time": "10:00",
            "end_time": "16:00",
        },
        headers=other_headers,
    )

    listed = await client.get(
        f"/api/schedule/availability/{other_user.id}",
        headers=auth_headers,
    )

    assert created.status_code == 201
    assert listed.status_code == 200
    assert listed.json() == []
