"""Authentication router for OAuth/OIDC flows.

Handles login, callback, token refresh, logout, and session management.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user as get_bearer_current_user
from app.deps import require_roles
from app.models.user import User, UserRole
from app.schemas.auth import (
    PasswordRotationComplete,
    SeedAdminOut,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserOut,
)
from app.services.audit_service import log_event
from app.services.auth_service import (
    authenticate_user,
    complete_password_rotation,
    create_access_token,
    create_user,
    get_user_by_email,
    seed_admin,
    temporary_password_is_expired,
)
from app.services.identity_service import (
    AuthenticationError,
    IdentityProvider,
    MFARequiredError,
    PKCEHelper,
    SessionManager,
    TokenExpiredError,
    authenticate_with_provider,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
api_router = APIRouter(prefix="/api/auth", tags=["authentication"])

# In production, use Redis
_session_manager = SessionManager()
DbDep = Annotated[AsyncSession, Depends(get_db)]
BearerUserDep = Annotated[User, Depends(get_bearer_current_user)]
ManagerUserDep = Annotated[User, Depends(require_roles(UserRole.admin, UserRole.manager))]


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value, user.session_version),
        user=user,
    )


def _is_staff_user(user: User) -> bool:
    return user.role in {
        UserRole.admin,
        UserRole.manager,
        UserRole.provider,
        UserRole.ma,
        UserRole.front_desk,
    }


async def _block_local_production_staff_login(db: AsyncSession, user: User) -> None:
    if (
        settings.is_production
        and settings.require_external_mfa_in_production
        and _is_staff_user(user)
    ):
        await log_event(
            db,
            "auth.login_blocked",
            "user",
            user.id,
            actor_id=user.id,
            payload={"reason": "external_mfa_required"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Production staff login requires external MFA provider handoff",
        )


@api_router.post("/login", response_model=TokenResponse)
async def staff_login(
    data: UserLogin,
    db: DbDep,
) -> TokenResponse:
    """Authenticate a local staff user for non-production or demo workflows."""
    user = await authenticate_user(db, str(data.email), data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.password_must_change:
        if temporary_password_is_expired(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Temporary password expired",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required before login",
        )

    await _block_local_production_staff_login(db, user)

    user.last_login_at = _utcnow()
    await db.commit()
    await db.refresh(user)
    await log_event(
        db,
        "auth.login",
        "user",
        user.id,
        actor_id=user.id,
        payload={"method": "local_password"},
    )
    return _token_response(user)


@api_router.get("/me", response_model=UserOut)
async def staff_me(current_user: BearerUserDep) -> User:
    """Return the bearer-token staff session."""
    return current_user


@api_router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_staff_user(
    data: UserCreate,
    db: DbDep,
    current_user: ManagerUserDep,
) -> User:
    """Create a staff user scoped to the current clinic organization."""
    requested_role = UserRole(data.role)
    requested_org = data.organization_id or current_user.organization_id

    if requested_org != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create users outside the current organization",
        )
    if current_user.role != UserRole.admin and requested_role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Managers cannot create admin users",
        )

    existing = await get_user_by_email(db, str(data.email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    user = await create_user(
        db,
        email=str(data.email),
        password=data.password,
        display_name=data.display_name,
        role=requested_role.value,
        organization_id=requested_org,
    )
    await log_event(
        db,
        "user.created",
        "user",
        user.id,
        actor_id=current_user.id,
        payload={"role": user.role.value, "organization_id": user.organization_id},
    )
    return user


@api_router.post("/complete-password-rotation", response_model=TokenResponse)
async def complete_staff_password_rotation(
    data: PasswordRotationComplete,
    db: DbDep,
) -> TokenResponse:
    """Replace a temporary password before issuing a staff session."""
    try:
        user = await complete_password_rotation(
            db,
            str(data.email),
            data.current_password,
            data.new_password,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    await _block_local_production_staff_login(db, user)
    user.last_login_at = _utcnow()
    await db.commit()
    await db.refresh(user)
    await log_event(
        db,
        "auth.password_rotated",
        "user",
        user.id,
        actor_id=user.id,
        payload={"method": "temporary_password"},
    )
    return _token_response(user)


@api_router.post("/seed", response_model=SeedAdminOut, status_code=status.HTTP_201_CREATED)
async def seed_initial_admin(db: DbDep) -> SeedAdminOut:
    """Create the first admin account when local seeding is explicitly enabled."""
    if not settings.allow_seed_endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    seeded = await seed_admin(db)
    if seeded is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Admin seed already exists",
        )
    user, temporary_password = seeded
    await log_event(
        db,
        "user.created",
        "user",
        user.id,
        actor_id=user.id,
        payload={"role": user.role.value, "source": "seed_endpoint"},
    )
    return SeedAdminOut(user=user, temporary_password=temporary_password)


@router.get("/login/{provider}")
async def login(
    provider: IdentityProvider,
    redirect_after: str = "/",
    response: Response = None,
) -> RedirectResponse:
    """Initiate OAuth login flow."""
    response = response or Response()
    try:
        client = _get_client(provider)

        # Generate PKCE and state
        code_verifier = PKCEHelper.generate_code_verifier()
        code_challenge = PKCEHelper.generate_code_challenge(code_verifier)
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)

        # Store PKCE verifier in cookie (encrypted in production)
        response.set_cookie(
            key="auth_state",
            value=state,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=600,
        )
        response.set_cookie(
            key="pkce_verifier",
            value=code_verifier,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=600,
        )
        response.set_cookie(
            key="redirect_after",
            value=redirect_after,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=600,
        )

        auth_url = client.get_authorization_url(
            state=state,
            nonce=nonce,
            code_challenge=code_challenge,
        )

        return RedirectResponse(url=auth_url, status_code=302)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {e}") from e


@router.get("/callback/{provider}")
async def callback(
    provider: IdentityProvider,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    auth_state: str | None = Cookie(None),
    pkce_verifier: str | None = Cookie(None),
    redirect_after: str = Cookie("/"),
    response: Response = None,
) -> RedirectResponse:
    """Handle OAuth callback."""
    response = response or Response()
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    if not code:
        raise HTTPException(status_code=400, detail="No authorization code")

    # Validate state
    if state != auth_state:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    try:
        user, tokens = await authenticate_with_provider(provider, code, pkce_verifier)

        # Create session
        session_token = _session_manager.create_session(user)

        # Set session cookie
        response.set_cookie(
            key="session",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=86400,
        )

        # Clear auth cookies
        response.delete_cookie("auth_state")
        response.delete_cookie("pkce_verifier")
        response.delete_cookie("redirect_after")

        return RedirectResponse(url=redirect_after, status_code=302)

    except MFARequiredError:
        # Redirect to MFA challenge page
        return RedirectResponse(url="/mfa-challenge", status_code=302)
    except TokenExpiredError as e:
        raise HTTPException(status_code=401, detail="Token expired") from e
    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response = None,
) -> dict[str, Any]:
    """Refresh access token."""
    response = response or Response()
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    provider = payload.get("provider")
    refresh_token_value = payload.get("refresh_token")
    if not provider or not refresh_token_value:
        raise HTTPException(status_code=422, detail="provider and refresh_token are required")

    try:
        client = _get_client(IdentityProvider(provider))
        return await client.refresh_token(refresh_token_value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Unsupported identity provider") from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/logout")
async def logout(
    session: str | None = Cookie(None),
    response: Response = None,
) -> dict[str, str]:
    """Logout and clear session."""
    response = response or Response()
    if session:
        _session_manager.revoke_session(session)

    response.delete_cookie("session")
    return {"status": "logged_out"}


@router.get("/me")
async def get_current_user(
    session: str | None = Cookie(None),
) -> dict[str, Any]:
    """Get current authenticated user."""
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = _session_manager.validate_session(session)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")

    return user.to_dict()


@router.get("/session/validate")
async def validate_session(
    session: str | None = Cookie(None),
) -> dict[str, bool]:
    """Validate if session is active."""
    if not session:
        return {"valid": False}

    user = _session_manager.validate_session(session)
    return {"valid": user is not None}


@router.get("/session-policy")
async def session_policy() -> dict[str, Any]:
    """Return the active session and password policy for readiness checks."""
    return {
        "access_token_expire_minutes": settings.access_token_expire_minutes,
        "session_ttl_seconds": 86400,
        "require_external_mfa_in_production": settings.require_external_mfa_in_production,
        "auth_rate_limit_attempts": settings.auth_rate_limit_attempts,
        "auth_rate_limit_window_seconds": settings.auth_rate_limit_window_seconds,
        "temporary_password_expire_hours": 24,
        "password_min_length": 12,
    }


def _get_client(provider: IdentityProvider):
    """Get OIDC client for provider."""
    from app.services.identity_service import OIDCClient

    return OIDCClient(provider)


async def require_auth(
    session: str | None = Cookie(None),
) -> dict[str, Any]:
    """Dependency to require authentication."""
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = _session_manager.validate_session(session)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")

    return user.to_dict()
