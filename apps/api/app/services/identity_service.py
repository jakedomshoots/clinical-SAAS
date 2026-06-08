"""Identity and authentication service for OAuth/OIDC integration.

Supports multiple identity providers:
- Auth0
- Okta
- Azure AD
- Google Workspace
- Generic OIDC

All authentication flows enforce MFA when configured.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any

import httpx
from jose import jwt, ExpiredSignatureError
from jose.exceptions import JWTError

from app.config import settings
from app.integrations.base import IntegrationNotConfiguredError


class IdentityProvider(str, Enum):
    AUTH0 = "auth0"
    OKTA = "okta"
    AZURE_AD = "azure_ad"
    GOOGLE = "google"
    GENERIC_OIDC = "generic_oidc"


class AuthenticationError(Exception):
    """Raised when authentication fails."""

    pass


class MFARequiredError(Exception):
    """Raised when MFA is required but not completed."""

    pass


class TokenExpiredError(Exception):
    """Raised when a token has expired."""

    pass


@dataclass(frozen=True)
class UserIdentity:
    """Canonical user identity from any provider."""

    provider: IdentityProvider
    provider_user_id: str
    email: str
    name: str | None = None
    roles: list[str] | None = None
    groups: list[str] | None = None
    mfa_verified: bool = False
    session_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider.value,
            "provider_user_id": self.provider_user_id,
            "email": self.email,
            "name": self.name,
            "roles": self.roles or [],
            "groups": self.groups or [],
            "mfa_verified": self.mfa_verified,
            "session_id": self.session_id,
        }


@dataclass(frozen=True)
class MFAMethod:
    """MFA method configuration."""

    method_type: str  # totp, sms, email, webauthn
    label: str
    verified: bool
    last_used_at: str | None = None


class OIDCClient:
    """Generic OIDC client that works with any compliant provider."""

    def __init__(self, provider: IdentityProvider) -> None:
        self.provider = provider
        self._config = self._load_provider_config()

    def _load_provider_config(self) -> dict[str, Any]:
        """Load provider-specific configuration from settings."""
        prefix = f"IDENTITY_{self.provider.value.upper()}_"

        issuer_url = getattr(settings, f"{prefix}ISSUER_URL", None)
        if not issuer_url:
            raise IntegrationNotConfiguredError(
                f"Identity provider {self.provider.value} is not configured. "
                f"Set {prefix}ISSUER_URL in environment."
            )

        return {
            "issuer_url": issuer_url.rstrip("/"),
            "client_id": getattr(settings, f"{prefix}CLIENT_ID", ""),
            "client_secret": getattr(settings, f"{prefix}CLIENT_SECRET", ""),
            "redirect_uri": getattr(settings, f"{prefix}REDIRECT_URI", ""),
            "scopes": getattr(
                settings,
                f"{prefix}SCOPES",
                "openid profile email",
            ),
            "mfa_required": getattr(settings, f"{prefix}MFA_REQUIRED", True),
            "allowed_domains": getattr(settings, f"{prefix}ALLOWED_DOMAINS", []),
            "role_claim": getattr(settings, f"{prefix}ROLE_CLAIM", "roles"),
            "group_claim": getattr(settings, f"{prefix}GROUP_CLAIM", "groups"),
        }

    async def get_discovery_document(self) -> dict[str, Any]:
        """Fetch OIDC discovery document from provider."""
        issuer = self._config["issuer_url"]
        discovery_url = f"{issuer}/.well-known/openid-configuration"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(discovery_url)
            response.raise_for_status()
            return response.json()

    async def get_jwks(self) -> dict[str, Any]:
        """Fetch JSON Web Key Set from provider."""
        discovery = await self.get_discovery_document()
        jwks_uri = discovery.get("jwks_uri")

        if not jwks_uri:
            raise AuthenticationError("JWKS URI not found in discovery document")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(jwks_uri)
            response.raise_for_status()
            return response.json()

    def _get_signing_key(self, jwks: dict[str, Any], token: str) -> dict[str, Any] | None:
        """Find the signing key for a token from the JWKS."""
        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")

            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    return key

            return None
        except JWTError:
            return None

    async def validate_token(self, token: str) -> UserIdentity:
        """Validate an ID token and return canonical user identity."""
        discovery = await self.get_discovery_document()
        jwks = await self.get_jwks()
        signing_key = self._get_signing_key(jwks, token)

        if not signing_key:
            raise AuthenticationError("Unable to find signing key for token")

        try:
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=self._config["client_id"],
                issuer=discovery.get("issuer"),
            )
        except ExpiredSignatureError:
            raise TokenExpiredError("Token has expired")
        except JWTError as e:
            raise AuthenticationError(f"Invalid token: {e}")

        # Check MFA if required
        mfa_verified = payload.get("amr", [])
        mfa_verified = any(
            method in mfa_verified
            for method in ["mfa", "otp", "sms", "webauthn"]
        )

        if self._config["mfa_required"] and not mfa_verified:
            # Check if provider has custom MFA claim
            mfa_claim = payload.get("mfa_verified", False)
            if not mfa_claim:
                raise MFARequiredError("Multi-factor authentication required")
            mfa_verified = True

        # Extract roles and groups
        roles = payload.get(self._config["role_claim"], [])
        if isinstance(roles, str):
            roles = [roles]

        groups = payload.get(self._config["group_claim"], [])
        if isinstance(groups, str):
            groups = [groups]

        # Domain validation
        email = payload.get("email", "")
        allowed_domains = self._config["allowed_domains"]
        if allowed_domains:
            domain = email.split("@")[-1].lower()
            if domain not in [d.lower() for d in allowed_domains]:
                raise AuthenticationError(
                    f"Email domain '{domain}' is not allowed"
                )

        return UserIdentity(
            provider=self.provider,
            provider_user_id=payload.get("sub", ""),
            email=email,
            name=payload.get("name") or payload.get("preferred_username"),
            roles=roles,
            groups=groups,
            mfa_verified=mfa_verified,
            session_id=payload.get("sid") or secrets.token_hex(16),
        )

    async def exchange_code(self, code: str, code_verifier: str | None = None) -> dict[str, Any]:
        """Exchange authorization code for tokens."""
        discovery = await self.get_discovery_document()
        token_endpoint = discovery.get("token_endpoint")

        if not token_endpoint:
            raise AuthenticationError("Token endpoint not found")

        data = {
            "grant_type": "authorization_code",
            "client_id": self._config["client_id"],
            "client_secret": self._config["client_secret"],
            "code": code,
            "redirect_uri": self._config["redirect_uri"],
        }

        if code_verifier:
            data["code_verifier"] = code_verifier

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                token_endpoint,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            return response.json()

    async def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        """Refresh an access token."""
        discovery = await self.get_discovery_document()
        token_endpoint = discovery.get("token_endpoint")

        if not token_endpoint:
            raise AuthenticationError("Token endpoint not found")

        data = {
            "grant_type": "refresh_token",
            "client_id": self._config["client_id"],
            "client_secret": self._config["client_secret"],
            "refresh_token": refresh_token,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                token_endpoint,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            return response.json()

    async def revoke_token(self, token: str, token_type_hint: str = "access_token") -> None:
        """Revoke a token."""
        discovery = await self.get_discovery_document()
        revocation_endpoint = discovery.get("revocation_endpoint")

        if not revocation_endpoint:
            return  # Provider doesn't support revocation

        data = {
            "token": token,
            "token_type_hint": token_type_hint,
            "client_id": self._config["client_id"],
            "client_secret": self._config["client_secret"],
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                revocation_endpoint,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

    def get_authorization_url(
        self,
        state: str,
        nonce: str,
        code_challenge: str | None = None,
    ) -> str:
        """Build authorization URL for initiating OAuth flow."""
        import asyncio

        discovery = asyncio.run(self.get_discovery_document())
        auth_endpoint = discovery.get("authorization_endpoint")

        if not auth_endpoint:
            raise AuthenticationError("Authorization endpoint not found")

        params = {
            "response_type": "code",
            "client_id": self._config["client_id"],
            "redirect_uri": self._config["redirect_uri"],
            "scope": self._config["scopes"],
            "state": state,
            "nonce": nonce,
        }

        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"

        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{auth_endpoint}?{query}"


class SessionManager:
    """Manages user sessions with secure token generation."""

    def __init__(self, redis_client=None) -> None:
        self._redis = redis_client
        self._session_ttl = 86400  # 24 hours

    def create_session(self, user_identity: UserIdentity) -> str:
        """Create a new session and return session token."""
        session_token = secrets.token_urlsafe(32)
        session_data = {
            "user": user_identity.to_dict(),
            "created_at": time.time(),
            "last_accessed_at": time.time(),
        }

        if self._redis:
            import json

            self._redis.setex(
                f"session:{session_token}",
                self._session_ttl,
                json.dumps(session_data),
            )

        return session_token

    def validate_session(self, session_token: str) -> UserIdentity | None:
        """Validate a session token and return user identity."""
        if not self._redis:
            return None

        import json

        data = self._redis.get(f"session:{session_token}")
        if not data:
            return None

        session_data = json.loads(data)
        user_data = session_data.get("user", {})

        # Update last accessed
        session_data["last_accessed_at"] = time.time()
        self._redis.setex(
            f"session:{session_token}",
            self._session_ttl,
            json.dumps(session_data),
        )

        return UserIdentity(
            provider=IdentityProvider(user_data.get("provider", "generic_oidc")),
            provider_user_id=user_data.get("provider_user_id", ""),
            email=user_data.get("email", ""),
            name=user_data.get("name"),
            roles=user_data.get("roles", []),
            groups=user_data.get("groups", []),
            mfa_verified=user_data.get("mfa_verified", False),
            session_id=session_token,
        )

    def revoke_session(self, session_token: str) -> None:
        """Revoke a session."""
        if self._redis:
            self._redis.delete(f"session:{session_token}")

    def revoke_all_user_sessions(self, provider_user_id: str) -> None:
        """Revoke all sessions for a user."""
        if not self._redis:
            return

        # This requires scanning keys - in production use a secondary index
        for key in self._redis.scan_iter(match="session:*"):
            data = self._redis.get(key)
            if data:
                import json

                session_data = json.loads(data)
                user = session_data.get("user", {})
                if user.get("provider_user_id") == provider_user_id:
                    self._redis.delete(key)


class PKCEHelper:
    """PKCE (Proof Key for Code Exchange) helper for secure OAuth flows."""

    @staticmethod
    def generate_code_verifier() -> str:
        """Generate a code verifier."""
        return secrets.token_urlsafe(32)

    @staticmethod
    def generate_code_challenge(verifier: str) -> str:
        """Generate S256 code challenge from verifier."""
        digest = hashlib.sha256(verifier.encode()).digest()
        import base64

        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


class WebhookSignatureVerifier:
    """Verify webhook signatures from various providers."""

    @staticmethod
    def verify_hmac_sha256(payload: bytes, signature: str, secret: str) -> bool:
        """Verify HMAC-SHA256 signature."""
        expected = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()

        # Support both hex and base64 encoded signatures
        if signature.startswith("sha256="):
            signature = signature[7:]

        return hmac.compare_digest(signature, expected)

    @staticmethod
    def verify_hmac_sha512(payload: bytes, signature: str, secret: str) -> bool:
        """Verify HMAC-SHA512 signature."""
        expected = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha512,
        ).hexdigest()

        if signature.startswith("sha512="):
            signature = signature[7:]

        return hmac.compare_digest(signature, expected)

    @staticmethod
    def verify_twilio_signature(
        url: str,
        params: dict[str, str],
        signature: str,
        auth_token: str,
    ) -> bool:
        """Verify Twilio request signature."""
        # Twilio signs the full URL with sorted POST params
        sorted_params = "".join(
            f"{k}{v}" for k, v in sorted(params.items())
        )
        payload = url + sorted_params

        expected = base64.b64encode(
            hmac.new(
                auth_token.encode(),
                payload.encode(),
                hashlib.sha1,
            ).digest()
        ).decode()

        return hmac.compare_digest(signature, expected)


# Convenience functions for common identity providers

async def get_auth0_client() -> OIDCClient:
    """Get configured Auth0 client."""
    return OIDCClient(IdentityProvider.AUTH0)


async def get_okta_client() -> OIDCClient:
    """Get configured Okta client."""
    return OIDCClient(IdentityProvider.OKTA)


async def get_azure_ad_client() -> OIDCClient:
    """Get configured Azure AD client."""
    return OIDCClient(IdentityProvider.AZURE_AD)


async def get_google_client() -> OIDCClient:
    """Get configured Google Workspace client."""
    return OIDCClient(IdentityProvider.GOOGLE)


async def authenticate_with_provider(
    provider: IdentityProvider,
    authorization_code: str,
    code_verifier: str | None = None,
) -> tuple[UserIdentity, dict[str, Any]]:
    """Complete OAuth flow and return user identity with tokens."""
    client = OIDCClient(provider)

    # Exchange code for tokens
    token_response = await client.exchange_code(authorization_code, code_verifier)
    id_token = token_response.get("id_token")

    if not id_token:
        raise AuthenticationError("No ID token in response")

    # Validate token and get user identity
    user = await client.validate_token(id_token)

    return user, token_response
