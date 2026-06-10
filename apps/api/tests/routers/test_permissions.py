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


@pytest.mark.asyncio
async def test_role_access_matrix_is_manager_only_and_reports_capabilities(
    client: AsyncClient,
    auth_headers,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-role-matrix@example.com")
    provider = await make_user(db, UserRole.provider, "provider-role-matrix@example.com")
    front_desk = await make_user(db, UserRole.front_desk, "front-desk-role-matrix@example.com")
    front_desk_headers = headers_for(front_desk)

    blocked = await client.get("/api/users/role-access-matrix", headers=front_desk_headers)
    allowed = await client.get("/api/users/role-access-matrix", headers=headers_for(manager))

    assert blocked.status_code == 403
    assert allowed.status_code == 200
    data = allowed.json()
    assert data["total_roles"] == 5
    assert data["generated_at"]
    assert data["summary"]["active_users"] >= 3
    assert data["summary"]["privileged_roles"] == 2
    role_keys = {role["role"] for role in data["roles"]}
    assert {"admin", "manager", "provider", "ma", "front_desk"} <= role_keys
    provider_role = next(role for role in data["roles"] if role["role"] == provider.role.value)
    front_desk_role = next(role for role in data["roles"] if role["role"] == front_desk.role.value)
    assert provider_role["can_manage_staff"] is False
    assert provider_role["can_manage_clinical"] is True
    assert front_desk_role["can_manage_front_office"] is True
    assert front_desk_role["can_manage_clinical"] is False
    assert any(item["key"] == "privileged_mfa_required" for item in data["warnings"])


@pytest.mark.asyncio
async def test_operational_readiness_endpoints_require_manager(
    client: AsyncClient,
    db: AsyncSession,
):
    manager = await make_user(db, UserRole.manager, "manager-readiness@example.com")
    provider = await make_user(db, UserRole.provider, "provider-readiness@example.com")

    ready_blocked = await client.get("/api/ready", headers=headers_for(provider))
    ready_allowed = await client.get("/api/ready", headers=headers_for(manager))
    capabilities_blocked = await client.get(
        "/api/integration-capabilities", headers=headers_for(provider)
    )
    capabilities_allowed = await client.get(
        "/api/integration-capabilities", headers=headers_for(manager)
    )

    assert ready_blocked.status_code == 403
    assert ready_allowed.status_code == 200
    assert capabilities_blocked.status_code == 403
    assert capabilities_allowed.status_code == 200
