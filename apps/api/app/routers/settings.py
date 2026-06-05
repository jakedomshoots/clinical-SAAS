from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, manager_write_required
from app.models.user import User
from app.schemas.settings import ClinicSettingsOut, ClinicSettingsUpdate
from app.services import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
ManagerUserDep = Annotated[User, Depends(manager_write_required)]


@router.get("", response_model=ClinicSettingsOut)
async def get_settings(db: DbDep, current_user: CurrentUserDep):
    settings = await settings_service.get_or_create_settings(db, current_user)
    return ClinicSettingsOut.model_validate(settings, from_attributes=True)


@router.patch("", response_model=ClinicSettingsOut)
async def update_settings(data: ClinicSettingsUpdate, db: DbDep, current_user: ManagerUserDep):
    settings = await settings_service.update_settings(
        db,
        current_user,
        data.model_dump(exclude_unset=True),
    )
    return ClinicSettingsOut.model_validate(settings, from_attributes=True)
