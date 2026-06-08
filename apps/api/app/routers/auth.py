"""Authentication router for OAuth/OIDC flows.

Handles login, callback, token refresh, logout, and session management.
"""

from __future__ import annotations

import secrets
from typing import Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

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

# In production, use Redis
_session_manager = SessionManager()


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
        raise HTTPException(status_code=500, detail=f"Login failed: {e}")


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
        user, tokens = await authenticate_with_provider(
            provider, code, pkce_verifier
        )

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
    except TokenExpiredError:
        raise HTTPException(status_code=401, detail="Token expired")
    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response = None,
) -> dict[str, Any]:
    """Refresh access token."""
    response = response or Response()
    # Implementation depends on token storage strategy
    raise HTTPException(status_code=501, detail="Not implemented")


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
