from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserDirectoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserDirectoryListOut(BaseModel):
    data: list[UserDirectoryOut]
    total: int


class UserUpdate(BaseModel):
    display_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
