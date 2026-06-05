import asyncio

from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory
from app.minio_client import minio
from app.redis_client import redis

READINESS_TIMEOUT_SECONDS = 1.5


async def check_readiness() -> dict:
    checks = {
        "database": await _check_database(),
        "redis": await _check_redis(),
        "object_storage": await _check_object_storage(),
    }
    integrations = check_external_integrations()
    operational_checks = [*checks.values(), *integrations.values()]
    return {
        "status": "ok" if all(item["ok"] for item in checks.values()) else "degraded",
        "operational_status": (
            "ok" if all(item["ok"] for item in operational_checks) else "degraded"
        ),
        "environment": settings.app_env,
        "checks": checks,
        "integrations": integrations,
    }


def check_external_integrations() -> dict:
    return {
        "ehr": _configured(settings.ehr_api_base_url, "EHR_API_BASE_URL"),
        "fax_provider": _configured(settings.fax_provider_api_key, "FAX_PROVIDER_API_KEY"),
        "portal": _configured(settings.portal_api_base_url, "PORTAL_API_BASE_URL"),
        "calendar": _configured(settings.calendar_api_base_url, "CALENDAR_API_BASE_URL"),
        "copilotkit": _configured(settings.copilotkit_runtime_url, "COPILOTKIT_RUNTIME_URL"),
    }


def _configured(value: str, env_var: str) -> dict:
    if value.strip():
        return {"ok": True, "configured": True, "env_var": env_var}
    return {
        "ok": False,
        "configured": False,
        "env_var": env_var,
        "mode": "demo",
    }


async def _check_database() -> dict:
    try:
        async def ping_database() -> None:
            async with async_session_factory() as db:
                await db.execute(text("select 1"))

        await asyncio.wait_for(ping_database(), timeout=READINESS_TIMEOUT_SECONDS)
        return {"ok": True}
    except TimeoutError:
        return {"ok": False, "error": "TimeoutError"}
    except Exception as exc:  # pragma: no cover - defensive for deployment diagnostics
        return {"ok": False, "error": exc.__class__.__name__}


async def _check_redis() -> dict:
    try:
        await asyncio.wait_for(redis.ping(), timeout=READINESS_TIMEOUT_SECONDS)
        return {"ok": True}
    except TimeoutError:
        return {"ok": False, "error": "TimeoutError"}
    except Exception as exc:  # pragma: no cover - defensive for deployment diagnostics
        return {"ok": False, "error": exc.__class__.__name__}


async def _check_object_storage() -> dict:
    try:
        exists = await asyncio.wait_for(
            asyncio.to_thread(minio.bucket_exists, settings.minio_bucket),
            timeout=READINESS_TIMEOUT_SECONDS,
        )
        return {"ok": exists, "bucket": settings.minio_bucket}
    except TimeoutError:
        return {"ok": False, "bucket": settings.minio_bucket, "error": "TimeoutError"}
    except Exception as exc:  # pragma: no cover - defensive for deployment diagnostics
        return {"ok": False, "bucket": settings.minio_bucket, "error": exc.__class__.__name__}
