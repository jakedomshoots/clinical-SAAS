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
            "first_name": "Permission",
            "last_name": "Patient",
            "dob": date(1984, 4, 4).isoformat(),
            "gender": "Unknown",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_front_desk_cannot_create_patient(client: AsyncClient, db: AsyncSession):
    user = await make_user(db, UserRole.front_desk, "front-desk-create-patient@example.com")

    res = await client.post(
        "/api/patients",
        json={
            "first_name": "Blocked",
            "last_name": "Patient",
            "dob": date(1990, 1, 1).isoformat(),
            "gender": "Unknown",
        },
        headers=headers_for(user),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_provider_cannot_send_fax(client: AsyncClient, db: AsyncSession):
    user = await make_user(db, UserRole.provider, "provider-send-fax@example.com")

    res = await client.post(
        "/api/faxes/send",
        json={"to_number": "+13125550100"},
        headers=headers_for(user),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_provider_cannot_create_appointment(
    client: AsyncClient,
    auth_headers,
    admin_user,
    db: AsyncSession,
):
    patient_id = await create_patient(client, auth_headers)
    user = await make_user(db, UserRole.provider, "provider-schedule@example.com")
    start = datetime(2026, 6, 5, 10, 0)
    end = start + timedelta(minutes=30)

    res = await client.post(
        "/api/schedule/appointments",
        json={
            "patient_id": patient_id,
            "provider_id": admin_user.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        },
        headers=headers_for(user),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_front_desk_cannot_set_provider_availability(
    client: AsyncClient,
    admin_user,
    db: AsyncSession,
):
    user = await make_user(db, UserRole.front_desk, "front-desk-availability@example.com")

    res = await client.post(
        "/api/schedule/availability",
        json={
            "provider_id": admin_user.id,
            "day_of_week": 2,
            "start_time": "09:00",
            "end_time": "12:00",
        },
        headers=headers_for(user),
    )

    assert res.status_code == 403
