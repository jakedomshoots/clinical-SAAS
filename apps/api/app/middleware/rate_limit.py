"""Rate limiting middleware for API protection.

Provides configurable rate limits per endpoint, user, and IP address.
Supports burst handling and distributed rate limiting via Redis.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


@dataclass
class RateLimitConfig:
    """Rate limit configuration."""

    requests_per_minute: int = 100
    burst_size: int = 20
    window_seconds: int = 60
    key_prefix: str = "rate_limit"
    excluded_paths: list[str] | None = None
    excluded_ips: list[str] | None = None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting requests."""

    def __init__(
        self,
        app: Any,
        config: RateLimitConfig | None = None,
        redis_client: Any | None = None,
    ) -> None:
        super().__init__(app)
        self.config = config or RateLimitConfig()
        self.redis = redis_client
        self._local_store: dict[str, list[float]] = {}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting."""
        # Skip rate limiting for excluded paths
        path = request.url.path
        if self.config.excluded_paths:
            for excluded in self.config.excluded_paths:
                if path.startswith(excluded):
                    return await call_next(request)

        # Get client identifier
        client_id = self._get_client_id(request)

        # Skip rate limiting for excluded IPs
        if self.config.excluded_ips and client_id in self.config.excluded_ips:
            return await call_next(request)

        # Check rate limit
        if not await self._is_allowed(client_id):
            return Response(
                content='{"detail":"Rate limit exceeded"}',
                status_code=429,
                headers={
                    "Content-Type": "application/json",
                    "Retry-After": str(self.config.window_seconds),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        remaining = await self._get_remaining(client_id)
        response.headers["X-RateLimit-Limit"] = str(self.config.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(self.config.window_seconds)

        return response

    def _get_client_id(self, request: Request) -> str:
        """Get client identifier from request."""
        # Use API key if present
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"api:{api_key}"

        # Use authenticated user if present
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"

        # Fall back to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"

        return f"ip:{request.client.host if request.client else 'unknown'}"

    async def _is_allowed(self, client_id: str) -> bool:
        """Check if request is allowed under rate limit."""
        now = time.time()
        window_start = now - self.config.window_seconds

        if self.redis:
            # Use Redis for distributed rate limiting
            key = f"{self.config.key_prefix}:{client_id}"

            # Remove old entries
            await self.redis.zremrangebyscore(key, 0, window_start)

            # Count current requests
            count = await self.redis.zcard(key)

            # Check burst limit
            if count >= self.config.burst_size:
                return False

            # Check rate limit
            if count >= self.config.requests_per_minute:
                return False

            # Add current request
            await self.redis.zadd(key, {str(now): now})
            await self.redis.expire(key, self.config.window_seconds)

            return True
        else:
            # Use local store (not distributed)
            if client_id not in self._local_store:
                self._local_store[client_id] = []

            # Remove old entries
            self._local_store[client_id] = [
                t for t in self._local_store[client_id]
                if t > window_start
            ]

            # Check limits
            if len(self._local_store[client_id]) >= self.config.burst_size:
                return False

            if len(self._local_store[client_id]) >= self.config.requests_per_minute:
                return False

            # Add current request
            self._local_store[client_id].append(now)

            return True

    async def _get_remaining(self, client_id: str) -> int:
        """Get remaining requests for client."""
        if self.redis:
            key = f"{self.config.key_prefix}:{client_id}"
            count = await self.redis.zcard(key)
        else:
            count = len(self._local_store.get(client_id, []))

        return max(0, self.config.requests_per_minute - count)


class RateLimiter:
    """Standalone rate limiter for specific operations."""

    def __init__(self, config: RateLimitConfig | None = None) -> None:
        self.config = config or RateLimitConfig()
        self._store: dict[str, list[float]] = {}

    def is_allowed(self, key: str) -> bool:
        """Check if operation is allowed."""
        now = time.time()
        window_start = now - self.config.window_seconds

        if key not in self._store:
            self._store[key] = []

        # Clean old entries
        self._store[key] = [
            t for t in self._store[key]
            if t > window_start
        ]

        # Check limit
        if len(self._store[key]) >= self.config.requests_per_minute:
            return False

        # Record request
        self._store[key].append(now)
        return True

    def get_remaining(self, key: str) -> int:
        """Get remaining quota for key."""
        count = len(self._store.get(key, []))
        return max(0, self.config.requests_per_minute - count)

    def reset(self, key: str) -> None:
        """Reset rate limit for key."""
        self._store.pop(key, None)


# Default rate limit configurations

PUBLIC_ENDPOINTS = RateLimitConfig(
    requests_per_minute=60,
    burst_size=10,
    excluded_paths=["/health", "/metrics"],
)

AUTHENTICATED_ENDPOINTS = RateLimitConfig(
    requests_per_minute=300,
    burst_size=50,
)

ADMIN_ENDPOINTS = RateLimitConfig(
    requests_per_minute=100,
    burst_size=20,
)

WEBHOOK_ENDPOINTS = RateLimitConfig(
    requests_per_minute=1000,
    burst_size=100,
    excluded_paths=["/webhooks/"],
)
