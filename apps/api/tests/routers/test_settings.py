import pytest

from app.models.user import UserRole
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_get_and_update_clinic_settings(client, auth_headers):
    current = await client.get("/api/settings", headers=auth_headers)
    assert current.status_code == 200
    assert current.json()["reminder_offsets_minutes"] == [1440, 120]

    updated = await client.patch(
        "/api/settings",
        json={
            "reminder_offsets_minutes": [60, 1440],
            "sender_identity": "Northside Clinic",
            "reminder_sms_template": "Reminder from {clinic_name}: appointment at {appointment_time}.",
        },
        headers=auth_headers,
    )

    assert updated.status_code == 200
    assert updated.json()["reminder_offsets_minutes"] == [1440, 60]
    assert updated.json()["sender_identity"] == "Northside Clinic"


@pytest.mark.asyncio
async def test_non_manager_cannot_update_clinic_settings(client, db):
    provider = await make_user(db, UserRole.provider, "settings-provider@example.com")

    updated = await client.patch(
        "/api/settings",
        json={"sender_identity": "Provider Edit"},
        headers=headers_for(provider),
    )

    assert updated.status_code == 403
