from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserDirectoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    role: str
    is_active: bool
    mfa_enabled: bool
    password_must_change: bool
    temporary_password_expires_at: datetime | None
    last_login_at: datetime | None
    access_reviewed_at: datetime | None
    access_reviewed_by_id: str | None
    access_review_note: str | None
    created_at: datetime
    updated_at: datetime


class UserDirectoryListOut(BaseModel):
    data: list[UserDirectoryOut]
    total: int


class UserUpdate(BaseModel):
    display_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    mfa_enabled: bool | None = None


class UserAccessReviewItemOut(BaseModel):
    user: UserDirectoryOut
    review_status: str
    findings: list[str]
    recommended_action: str


class UserAccessReviewSummaryOut(BaseModel):
    data: list[UserAccessReviewItemOut]
    total: int
    due_count: int
    privileged_without_mfa_count: int
    inactive_count: int
    review_window_days: int


class UserAccessReviewUpdate(BaseModel):
    note: str | None = Field(default=None, max_length=500)
    mfa_enabled: bool | None = None


class UserPasswordResetOut(BaseModel):
    user: UserDirectoryOut
    temporary_password: str
    temporary_password_expires_at: datetime


class UserRecoveryItemOut(BaseModel):
    user_id: str
    email: str
    display_name: str
    role: str
    status: str
    temporary_password_expires_at: datetime | None
    last_login_at: datetime | None


class UserRecoverySummaryOut(BaseModel):
    data: list[UserRecoveryItemOut]
    total: int
    temporary_password_count: int
    expired_temporary_password_count: int


class RoleAccessMatrixRoleOut(BaseModel):
    role: str
    label: str
    active_users: int
    can_view_patients: bool
    can_manage_clinical: bool
    can_manage_front_office: bool
    can_manage_staff: bool
    can_manage_operations: bool
    can_manage_integrations: bool
    can_export_audit: bool
    mfa_required: bool
    access_review_required: bool
    summary: str


class RoleAccessMatrixWarningOut(BaseModel):
    key: str
    label: str
    severity: str
    role: str | None = None
    detail: str


class RoleAccessMatrixOut(BaseModel):
    generated_at: datetime
    total_roles: int
    summary: dict[str, int]
    roles: list[RoleAccessMatrixRoleOut]
    warnings: list[RoleAccessMatrixWarningOut]
