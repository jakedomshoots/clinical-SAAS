import secrets
from datetime import UTC, datetime, timedelta

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
TEMPORARY_PASSWORD_EXPIRE_HOURS = 72


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def generate_temporary_password() -> str:
    return f"{secrets.token_urlsafe(18)}Aa1!"


def temporary_password_expires_at() -> datetime:
    return (datetime.now(UTC) + timedelta(hours=TEMPORARY_PASSWORD_EXPIRE_HOURS)).replace(tzinfo=None)


def temporary_password_is_expired(user: User) -> bool:
    if not user.password_must_change:
        return False
    if user.temporary_password_expires_at is None:
        return True
    return user.temporary_password_expires_at < datetime.now(UTC).replace(tzinfo=None)


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expire,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_patient_portal_token(patient_id: str, organization_id: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": patient_id,
        "role": "patient",
        "portal": True,
        "organization_id": organization_id,
        "exp": expire,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    email: str,
    password: str,
    display_name: str,
    role: str,
    organization_id: str = "default",
    password_must_change: bool = True,
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(password),
        display_name=display_name,
        role=UserRole(role),
        organization_id=organization_id,
        password_must_change=password_must_change,
        temporary_password_expires_at=temporary_password_expires_at()
        if password_must_change
        else None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def complete_password_rotation(
    db: AsyncSession,
    email: str,
    current_password: str,
    new_password: str,
) -> User | None:
    user = await get_user_by_email(db, email)
    if user is None or not user.is_active or not verify_password(current_password, user.hashed_password):
        return None
    if not user.password_must_change:
        return user
    if temporary_password_is_expired(user):
        raise PermissionError("Temporary password expired")
    user.hashed_password = hash_password(new_password)
    user.password_must_change = False
    user.temporary_password_expires_at = None
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


async def seed_admin(db: AsyncSession) -> tuple[User, str] | None:
    existing = await db.execute(select(User).limit(1))
    if existing.scalar_one_or_none() is not None:
        return None

    temporary_password = generate_temporary_password()
    user = await create_user(
        db,
        email="admin@clinic.example.com",
        password=temporary_password,
        display_name="Clinic Admin",
        role="admin",
        organization_id="default",
    )
    return user, temporary_password
