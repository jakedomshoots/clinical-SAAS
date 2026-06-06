from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.user import User, UserRole, utcnow
from app.schemas.auth import PasswordRotationComplete, SeedAdminOut, TokenResponse, UserCreate, UserLogin, UserOut
from app.services.audit_service import log_event
from app.services.auth_service import (
    authenticate_user,
    complete_password_rotation,
    create_access_token,
    create_user,
    seed_admin,
    temporary_password_is_expired,
)
from app.services.settings_service import get_or_create_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),  # noqa: B008
):
    from app.services.auth_service import get_user_by_email
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if data.role == "patient":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patient accounts not supported via this endpoint",
        )
    if current_user.role != UserRole.admin and data.role == UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Managers cannot grant admin access",
        )

    organization_id = data.organization_id or current_user.organization_id
    if current_user.role != UserRole.admin and organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create users outside your organization",
        )
    user = await create_user(
        db,
        data.email,
        data.password,
        data.display_name,
        data.role,
        organization_id=organization_id,
    )
    await log_event(
        db,
        "user.created",
        "user",
        user.id,
        actor_id=current_user.id,
        payload={"role": data.role, "organization_id": organization_id},
    )
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):  # noqa: B008
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.password_must_change:
        await log_event(
            db,
            "auth.login_blocked",
            "user",
            user.id,
            actor_id=user.id,
            payload={
                "reason": "password_rotation_required",
                "role": user.role.value,
                "temporary_password_expired": temporary_password_is_expired(user),
            },
        )
        detail = (
            "Temporary password expired"
            if temporary_password_is_expired(user)
            else "Password change required before login"
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    if settings.is_production and not user.mfa_enabled:
        await log_event(
            db,
            "auth.login_blocked",
            "user",
            user.id,
            actor_id=user.id,
            payload={"reason": "mfa_required", "role": user.role.value},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA enrollment required before production login",
        )

    user.last_login_at = utcnow()
    await db.commit()
    await db.refresh(user)
    await log_event(
        db,
        "auth.login",
        "user",
        user.id,
        actor_id=user.id,
        payload={"role": user.role.value, "mfa_enabled": user.mfa_enabled},
    )
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/complete-password-rotation", response_model=TokenResponse)
async def complete_password_rotation_route(
    data: PasswordRotationComplete,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    try:
        user = await complete_password_rotation(
            db,
            str(data.email),
            data.current_password,
            data.new_password,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.last_login_at = utcnow()
    await db.commit()
    await db.refresh(user)
    await log_event(
        db,
        "auth.password_rotated",
        "user",
        user.id,
        actor_id=user.id,
        payload={"role": user.role.value},
    )
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):  # noqa: B008
    return UserOut.model_validate(current_user)


@router.get("/session-policy")
async def session_policy(
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    clinic_settings = await get_or_create_settings(db, current_user)
    return {
        "user_id": current_user.id,
        "role": current_user.role.value,
        "access_token_expire_minutes": settings.access_token_expire_minutes,
        "mfa_required": settings.is_production,
        "mfa_enabled": current_user.mfa_enabled,
        "mfa_provider": "external_idp" if settings.is_production else "local_policy",
        "access_review_required": True,
        "access_review_window_days": 90,
        "last_login_at": current_user.last_login_at.isoformat() if current_user.last_login_at else None,
        "last_access_reviewed_at": (
            current_user.access_reviewed_at.isoformat()
            if current_user.access_reviewed_at
            else None
        ),
        "phi_reauth_required": True,
        "phi_reauth_minutes": clinic_settings.phi_reauth_minutes,
        "audit_retention_days": clinic_settings.audit_retention_days,
        "audit_events": [
            "auth.login",
            "auth.login_blocked",
            "auth.password_rotated",
            "patient_document.accessed",
            "settings.updated",
            "user.access_reviewed",
        ],
    }


@router.post("/seed", response_model=SeedAdminOut, status_code=status.HTTP_201_CREATED)
async def seed(db: AsyncSession = Depends(get_db)):  # noqa: B008
    if not settings.allow_seed_endpoint or settings.is_production:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    seeded = await seed_admin(db)
    if seeded is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Users already exist")
    admin, temporary_password = seeded
    await log_event(
        db,
        "user.seeded",
        "user",
        admin.id,
        actor_id=admin.id,
        payload={"role": "admin"},
    )
    return SeedAdminOut(
        user=UserOut.model_validate(admin),
        temporary_password=temporary_password,
    )
