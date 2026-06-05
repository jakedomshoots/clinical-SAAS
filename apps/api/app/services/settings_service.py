from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinic_settings import ClinicSettings
from app.models.user import User
from app.services.audit_service import log_event


async def get_or_create_settings(db: AsyncSession, user: User) -> ClinicSettings:
    result = await db.execute(
        select(ClinicSettings).where(ClinicSettings.organization_id == user.organization_id)
    )
    settings = result.scalar_one_or_none()
    if settings:
        return settings
    settings = ClinicSettings(organization_id=user.organization_id)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


async def update_settings(db: AsyncSession, user: User, data: dict) -> ClinicSettings:
    settings = await get_or_create_settings(db, user)
    if "reminder_offsets_minutes" in data and data["reminder_offsets_minutes"] is not None:
        settings.reminder_offsets_minutes = sorted({int(value) for value in data["reminder_offsets_minutes"]}, reverse=True)
    for field in ("reminder_sms_template", "reminder_email_template", "sender_identity", "audit_retention_days", "phi_reauth_minutes"):
        if field in data and data[field] is not None:
            setattr(settings, field, data[field])
    await db.commit()
    await db.refresh(settings)
    await log_event(
        db,
        "settings.updated",
        "clinic_settings",
        settings.id,
        actor_id=user.id,
        payload={"updated_fields": list(data.keys())},
    )
    return settings
