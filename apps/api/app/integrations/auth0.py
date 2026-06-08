"""Auth0 identity provider integration adapter.

Handles staff authentication, MFA, and role-based access control
via Auth0 Management API.

API Docs: https://auth0.com/docs/api/management/v2
"""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ConfiguredIntegration
from app.services.retry_service import with_api_retry


class Auth0Client(ConfiguredIntegration):
    """Auth0 Management API client."""

    name = "auth0"
    env_var = "AUTH0_API_KEY"
    adapter_detail = "Auth0 — staff SSO, MFA, and role-based access control"

    def _client(self) -> httpx.AsyncClient:
        from app.config import settings
        domain = getattr(settings, "auth0_domain", "")
        return httpx.AsyncClient(
            base_url=f"https://{domain}",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

    @property
    def _domain(self) -> str:
        from app.config import settings
        return getattr(settings, "auth0_domain", "")

    @with_api_retry(circuit_breaker="auth0")
    async def get_user(self, user_id: str) -> dict[str, Any]:
        """Get Auth0 user by ID."""
        self.require_configured()

        async with self._client() as client:
            response = await client.get(f"/api/v2/users/{user_id}")
            response.raise_for_status()
            data = response.json()

        return {
            "user_id": data.get("user_id"),
            "email": data.get("email"),
            "name": data.get("name"),
            "roles": data.get("app_metadata", {}).get("roles", []),
            "mfa_enabled": bool(data.get("multifactor", [])),
            "last_login": data.get("last_login"),
            "email_verified": data.get("email_verified", False),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="auth0")
    async def list_users(
        self,
        search: str | None = None,
        role: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List Auth0 users.

        Args:
            search: Email or name search
            role: Filter by role
            limit: Max results
        """
        self.require_configured()

        params: dict[str, str | int] = {"per_page": limit, "include_totals": "true"}
        if search:
            params["q"] = f'email:*{search}* OR name:*{search}*'
        if role:
            params["q"] = f'app_metadata.roles:"{role}"'

        async with self._client() as client:
            response = await client.get("/api/v2/users", params=params)
            response.raise_for_status()
            data = response.json()

        users = data.get("users", [])
        return [
            {
                "user_id": u.get("user_id"),
                "email": u.get("email"),
                "name": u.get("name"),
                "roles": u.get("app_metadata", {}).get("roles", []),
                "last_login": u.get("last_login"),
                "email_verified": u.get("email_verified", False),
            }
            for u in users
        ]

    @with_api_retry(circuit_breaker="auth0")
    async def create_user(
        self,
        email: str,
        name: str,
        roles: list[str],
        password: str | None = None,
        send_verification: bool = True,
    ) -> dict[str, Any]:
        """Create a new staff user in Auth0.

        Args:
            email: Staff email
            name: Full name
            roles: List of roles (e.g. ["provider", "admin"])
            password: Optional initial password (random if not provided)
            send_verification: Send verification email
        """
        self.require_configured()

        import secrets

        payload: dict[str, Any] = {
            "email": email,
            "name": name,
            "connection": "Username-Password-Authentication",
            "app_metadata": {"roles": roles},
            "email_verified": False,
        }

        if password:
            payload["password"] = password
        else:
            payload["password"] = secrets.token_urlsafe(16)

        if send_verification:
            payload["verify_email"] = True

        async with self._client() as client:
            response = await client.post("/api/v2/users", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "user_id": data.get("user_id"),
            "email": data.get("email"),
            "name": data.get("name"),
            "roles": roles,
            "created": True,
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="auth0")
    async def update_user_roles(
        self,
        user_id: str,
        roles: list[str],
    ) -> dict[str, Any]:
        """Update a user's roles."""
        self.require_configured()

        payload = {"app_metadata": {"roles": roles}}

        async with self._client() as client:
            response = await client.patch(f"/api/v2/users/{user_id}", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "user_id": user_id,
            "roles": roles,
            "updated": True,
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="auth0")
    async def delete_user(self, user_id: str) -> dict[str, Any]:
        """Deactivate/delete a user."""
        self.require_configured()

        async with self._client() as client:
            response = await client.delete(f"/api/v2/users/{user_id}")
            response.raise_for_status()

        return {"user_id": user_id, "deleted": True}

    @with_api_retry(circuit_breaker="auth0")
    async def get_login_url(self, redirect_uri: str, state: str = "") -> str:
        """Generate Universal Login URL.

        Args:
            redirect_uri: Where to redirect after login
            state: Optional state parameter for security
        """
        from app.config import settings
        client_id = getattr(settings, "auth0_client_id", "")

        params = f"response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&scope=openid%20profile%20email"
        if state:
            params += f"&state={state}"

        return f"https://{self._domain}/authorize?{params}"

    @with_api_retry(circuit_breaker="auth0")
    async def exchange_code_for_token(
        self,
        code: str,
        redirect_uri: str,
    ) -> dict[str, Any]:
        """Exchange authorization code for access token.

        Args:
            code: Authorization code from Auth0 callback
            redirect_uri: Same redirect URI used in login
        """
        self.require_configured()

        from app.config import settings
        client_id = getattr(settings, "auth0_client_id", "")
        client_secret = getattr(settings, "auth0_client_secret", "")

        payload = {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://{self._domain}/oauth/token",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        return {
            "access_token": data.get("access_token"),
            "id_token": data.get("id_token"),
            "refresh_token": data.get("refresh_token"),
            "expires_in": data.get("expires_in"),
            "token_type": data.get("token_type"),
            "raw_response": data,
        }
