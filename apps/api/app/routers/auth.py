from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.schemas.auth import SeedAdminOut, TokenResponse, UserCreate, UserLogin, UserOut
from app.services.audit_service import log_event
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_user,
    seed_admin,
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
        "phi_reauth_required": True,
        "phi_reauth_minutes": clinic_settings.phi_reauth_minutes,
        "audit_retention_days": clinic_settings.audit_retention_days,
        "audit_events": ["auth.login", "patient_document.accessed", "settings.updated"],
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
