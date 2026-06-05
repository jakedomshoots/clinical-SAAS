import asyncio
from pathlib import Path

from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory
from app.integrations.calendar import CalendarClient
from app.integrations.communications import CommunicationsClient
from app.integrations.copilotkit import CopilotRuntimeClient
from app.integrations.ehr import EHRClient
from app.integrations.fax_provider import FaxProviderClient
from app.integrations.portal import PortalClient
from app.minio_client import minio
from app.redis_client import redis

READINESS_TIMEOUT_SECONDS = 1.5


async def check_readiness() -> dict:
    checks = {
        "database": await _check_database(),
        "redis": await _check_redis(),
        "object_storage": await _check_object_storage(),
    }
    integrations = await check_external_integrations()
    operational_checks = [*checks.values(), *integrations.values()]
    return {
        "status": "ok" if all(item["ok"] for item in checks.values()) else "degraded",
        "operational_status": (
            "ok" if all(item["ok"] for item in operational_checks) else "degraded"
        ),
        "environment": settings.app_env,
        "checks": checks,
        "integrations": integrations,
        "deployment": _check_deployment_assets(),
    }


async def check_external_integrations() -> dict:
    integrations = [
        EHRClient(settings.ehr_api_base_url),
        FaxProviderClient(settings.fax_provider_api_key),
        PortalClient(settings.portal_api_base_url),
        CalendarClient(settings.calendar_api_base_url),
        CopilotRuntimeClient(settings.copilotkit_runtime_url),
        CommunicationsClient(settings.communications_provider_api_key),
    ]
    results = await asyncio.gather(*(client.health() for client in integrations))
    return {item.name: item.as_dict() for item in results}


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


def _check_deployment_assets() -> dict:
    repo_root = Path(__file__).resolve().parents[4]
    assets = {
        "production_env_template": repo_root / ".env.production.example",
        "deployment_runbook": repo_root / "docs" / "operations" / "deployment-runbook.md",
        "health_report_script": repo_root / "scripts" / "health-report.sh",
        "local_backup_script": repo_root / "scripts" / "backup-local.sh",
    }
    deployment = {
        key: {"ok": path.exists(), "path": str(path.relative_to(repo_root))}
        for key, path in assets.items()
    }
    deployment["latest_backup"] = _latest_backup_status(repo_root)
    return deployment


def _latest_backup_status(repo_root: Path) -> dict:
    backup_root = repo_root / "backups"
    manifests = sorted(backup_root.glob("*/manifest.txt"), reverse=True)
    if not manifests:
        return {"ok": False, "path": "backups", "last_success_at": None, "error": "No backup manifest found"}
    latest = manifests[0]
    created_at = None
    for line in latest.read_text().splitlines():
        if line.startswith("created_at="):
            created_at = line.split("=", 1)[1]
            break
    return {
        "ok": True,
        "path": str(latest.relative_to(repo_root)),
        "last_success_at": created_at,
    }
