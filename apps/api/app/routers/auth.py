from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.schemas.auth import TokenResponse, UserCreate, UserLogin, UserOut
from app.services.audit_service import log_event
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_user,
    seed_admin,
)

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

    user = await create_user(db, data.email, data.password, data.display_name, data.role)
    await log_event(
        db,
        "user.created",
        "user",
        user.id,
        actor_id=current_user.id,
        payload={"role": data.role},
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


@router.post("/seed", status_code=status.HTTP_201_CREATED)
async def seed(db: AsyncSession = Depends(get_db)):  # noqa: B008
    admin = await seed_admin(db)
    if admin is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Users already exist")
    await log_event(
        db,
        "user.seeded",
        "user",
        admin.id,
        actor_id=admin.id,
        payload={"role": "admin"},
    )
    return UserOut.model_validate(admin)
