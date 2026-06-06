from __future__ import annotations

import time

from app.config import settings
from app.redis_client import redis

_local_attempts: dict[str, tuple[int, float]] = {}


def _key(scope: str, identifier: str) -> str:
    return f"auth-rate:{scope}:{identifier.strip().lower()}"


async def auth_rate_limit_exceeded(scope: str, identifier: str) -> bool:
    key = _key(scope, identifier)
    try:
        value = await redis.get(key)
        return int(value or 0) >= settings.auth_rate_limit_attempts
    except Exception:
        count, expires_at = _local_attempts.get(key, (0, 0.0))
        if expires_at <= time.monotonic():
            _local_attempts.pop(key, None)
            return False
        return count >= settings.auth_rate_limit_attempts


async def record_auth_failure(scope: str, identifier: str) -> None:
    key = _key(scope, identifier)
    try:
        count = await redis.incr(key)
        if int(count) == 1:
            await redis.expire(key, settings.auth_rate_limit_window_seconds)
        return
    except Exception:
        now = time.monotonic()
        count, expires_at = _local_attempts.get(key, (0, 0.0))
        if expires_at <= now:
            count = 0
            expires_at = now + settings.auth_rate_limit_window_seconds
        _local_attempts[key] = (count + 1, expires_at)


async def clear_auth_failures(scope: str, identifier: str) -> None:
    key = _key(scope, identifier)
    try:
        await redis.delete(key)
    except Exception:
        _local_attempts.pop(key, None)
