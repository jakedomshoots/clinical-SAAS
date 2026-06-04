from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory
from app.minio_client import minio
from app.redis_client import redis


async def check_readiness() -> dict:
    checks = {
        "database": await _check_database(),
        "redis": await _check_redis(),
        "object_storage": await _check_object_storage(),
    }
    return {
        "status": "ok" if all(item["ok"] for item in checks.values()) else "degraded",
        "environment": settings.app_env,
        "checks": checks,
    }


async def _check_database() -> dict:
    try:
        async with async_session_factory() as db:
            await db.execute(text("select 1"))
        return {"ok": True}
    except Exception as exc:  # pragma: no cover - defensive for deployment diagnostics
        return {"ok": False, "error": exc.__class__.__name__}


async def _check_redis() -> dict:
    try:
        await redis.ping()
        return {"ok": True}
    except Exception as exc:  # pragma: no cover - defensive for deployment diagnostics
        return {"ok": False, "error": exc.__class__.__name__}


async def _check_object_storage() -> dict:
    try:
        exists = minio.bucket_exists(settings.minio_bucket)
        return {"ok": exists, "bucket": settings.minio_bucket}
    except Exception as exc:  # pragma: no cover - defensive for deployment diagnostics
        return {"ok": False, "bucket": settings.minio_bucket, "error": exc.__class__.__name__}
