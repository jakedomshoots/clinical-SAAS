from dataclasses import dataclass

from app.config import DEFAULT_SECRET_KEY, settings
from app.services.readiness_service import check_readiness


@dataclass(frozen=True)
class LaunchRequirement:
    key: str
    category: str
    label: str
    ready: bool
    severity: str
    detail: str
    action: str
    env_vars: list[str]
    docs: list[str]

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "category": self.category,
            "label": self.label,
            "ready": self.ready,
            "severity": self.severity,
            "detail": self.detail,
            "action": self.action,
            "env_vars": self.env_vars,
            "docs": self.docs,
        }


async def launch_readiness() -> dict:
    ready = await check_readiness()
    requirements = _requirements(ready)
    critical = sum(
        1 for item in requirements if not item.ready and item.severity == "critical"
    )
    warning = sum(
        1 for item in requirements if not item.ready and item.severity == "warning"
    )
    ready_count = sum(1 for item in requirements if item.ready)
    return {
        "production_ready": critical == 0,
        "score": round((ready_count / len(requirements)) * 100) if requirements else 0,
        "critical_blockers": critical,
        "warnings": warning,
        "environment": settings.app_env,
        "requirements": [item.as_dict() for item in requirements],
    }


def _requirements(ready: dict) -> list[LaunchRequirement]:
    deployment = ready.get("deployment", {})
    integrations = ready.get("integrations", {})
    checks = ready.get("checks", {})
    return [
        LaunchRequirement(
            key="production_env",
            category="Infrastructure",
            label="Production environment mode",
            ready=settings.is_production,
            severity="warning",
            detail=f"Current APP_ENV is {settings.app_env}.",
            action="Set APP_ENV=production for production deploys.",
            env_vars=["APP_ENV"],
            docs=["docs/operations/production-launch-checklist.md"],
        ),
        LaunchRequirement(
            key="secret_key",
            category="Security",
            label="Unique API signing secret",
            ready=settings.secret_key != DEFAULT_SECRET_KEY
            and len(settings.secret_key) >= 32,
            severity="critical",
            detail="JWT signing must not use the development default.",
            action="Generate and store a unique SECRET_KEY of at least 32 characters.",
            env_vars=["SECRET_KEY"],
            docs=[".env.production.example"],
        ),
        LaunchRequirement(
            key="seed_endpoint",
            category="Security",
            label="Seed endpoints disabled",
            ready=not settings.allow_seed_endpoint,
            severity="critical",
            detail="Seed endpoints are for local setup only.",
            action="Set ALLOW_SEED_ENDPOINT=false before production launch.",
            env_vars=["ALLOW_SEED_ENDPOINT"],
            docs=["docs/operations/production-launch-checklist.md"],
        ),
        LaunchRequirement(
            key="schema_migrations",
            category="Infrastructure",
            label="Explicit database migrations",
            ready=not settings.auto_create_schema,
            severity="critical",
            detail="Production should run Alembic migrations instead of auto-creating schema.",
            action="Set AUTO_CREATE_SCHEMA=false and run pnpm migrate:api during deploy.",
            env_vars=["AUTO_CREATE_SCHEMA"],
            docs=["scripts/migrate-api.sh"],
        ),
        LaunchRequirement(
            key="object_storage",
            category="Infrastructure",
            label="Object storage reachable",
            ready=bool(checks.get("object_storage", {}).get("ok")),
            severity="critical",
            detail=_check_detail(checks.get("object_storage")),
            action="Provision S3/MinIO credentials and confirm the bucket exists.",
            env_vars=[
                "MINIO_ENDPOINT",
                "MINIO_ACCESS_KEY",
                "MINIO_SECRET_KEY",
                "MINIO_BUCKET",
            ],
            docs=["docs/operations/production-launch-checklist.md"],
        ),
        LaunchRequirement(
            key="webhook_secret",
            category="Security",
            label="Webhook signing secret",
            ready=bool(settings.webhook_shared_secret)
            and len(settings.webhook_shared_secret) >= 16,
            severity="critical",
            detail="Inbound vendor callbacks require a shared secret, fresh timestamp header, HMAC payload signature, and stable event id.",
            action="Set WEBHOOK_SHARED_SECRET and configure vendors to send X-Concierge-Webhook-Secret, X-Concierge-Webhook-Timestamp, X-Concierge-Webhook-Signature, and event_id.",
            env_vars=["WEBHOOK_SHARED_SECRET"],
            docs=["docs/integrations/vendor-adapter-plan.md"],
        ),
        *_integration_requirements(integrations),
        LaunchRequirement(
            key="production_template",
            category="Operations",
            label="Production env template present",
            ready=bool(deployment.get("production_env_template", {}).get("ok")),
            severity="warning",
            detail=_check_detail(deployment.get("production_env_template")),
            action="Keep .env.production.example current with every required secret.",
            env_vars=[],
            docs=[".env.production.example"],
        ),
        LaunchRequirement(
            key="backup_restore",
            category="Operations",
            label="Backup and restore evidence",
            ready=bool(deployment.get("latest_backup", {}).get("ok"))
            and bool(deployment.get("latest_restore", {}).get("ok")),
            severity="warning",
            detail="Latest backup and restore markers should exist before go-live.",
            action="Run pnpm backup:local and pnpm backup:validate, then test restore.",
            env_vars=[],
            docs=["docs/operations/deployment-runbook.md"],
        ),
    ]


def _integration_requirements(integrations: dict) -> list[LaunchRequirement]:
    specs = [
        (
            "ehr",
            "EHR sync",
            ["EHR_API_BASE_URL"],
            "Connect demographics, medications, labs, and encounters.",
        ),
        (
            "fax_provider",
            "Fax provider",
            ["FAX_PROVIDER_API_KEY"],
            "Connect inbound and outbound fax delivery.",
        ),
        (
            "portal",
            "External patient portal",
            ["PORTAL_API_BASE_URL"],
            "Connect patient messages, intake, appointment requests, and document import.",
        ),
        (
            "calendar",
            "Calendar system",
            ["CALENDAR_API_BASE_URL"],
            "Connect appointment create/update synchronization.",
        ),
        (
            "communications",
            "SMS/email delivery",
            ["COMMUNICATIONS_PROVIDER", "COMMUNICATIONS_PROVIDER_API_KEY"],
            "Connect patient outreach delivery callbacks.",
        ),
        (
            "copilotkit",
            "CopilotKit runtime",
            ["COPILOTKIT_RUNTIME_URL"],
            "Deploy the AI runtime and approve model/tool policy.",
        ),
        (
            "clearinghouse",
            "Clearinghouse",
            ["CLEARINGHOUSE_API_BASE_URL", "CLEARINGHOUSE_API_KEY"],
            "Connect claim submission, denial, payment, and ERA/remittance callbacks.",
        ),
        (
            "labs_hie",
            "Labs / HIE",
            ["LABS_HIE_API_BASE_URL"],
            "Connect lab order submission, result import, and status tracking.",
        ),
        (
            "payments",
            "Payments",
            ["PAYMENTS_API_KEY"],
            "Connect patient payment processing, refunds, and reconciliation.",
        ),
        (
            "erx",
            "eRx",
            ["ERX_API_BASE_URL"],
            "Connect medication history, prescription transmission, and status callbacks.",
        ),
        (
            "identity",
            "Identity / MFA",
            ["IDENTITY_PROVIDER_ISSUER_URL"],
            "Connect staff authentication, MFA enforcement, and user provisioning.",
        ),
    ]
    requirements: list[LaunchRequirement] = []
    for key, label, env_vars, action in specs:
        check = integrations.get(key, {})
        requirements.append(
            LaunchRequirement(
                key=f"integration_{key}",
                category="Integrations",
                label=label,
                ready=bool(check.get("configured")),
                severity="critical",
                detail=_check_detail(check),
                action=action,
                env_vars=env_vars,
                docs=["docs/integrations/vendor-adapter-plan.md"],
            )
        )
    return requirements


def _check_detail(check: dict | None) -> str:
    if not check:
        return "No status reported."
    if check.get("ok"):
        return "Ready."
    if check.get("configured") is False:
        env_var = check.get("env_var")
        return f"Missing {env_var}." if env_var else "Not configured."
    if check.get("error"):
        return f"Failing with {check['error']}."
    return "Needs setup."
