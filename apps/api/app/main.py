from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.deps import require_roles
from app.minio_client import ensure_bucket
from app.models.user import User, UserRole
from app.redis_client import redis
from app.routers import (
    amendments,
    analytics,
    assistant,
    audit,
    auth,
    billing,
    claim_scrubber,
    clinical_decision_support,
    clinical_quality_measures,
    clinical_reconciliation,
    clinical_templates,
    emergency_access,
    esignature,
    family_history,
    faxes,
    form_builder,
    immunization_registry,
    implantable_devices,
    integration_capabilities,
    integrations,
    launch_readiness,
    messages,
    mips,
    operations,
    patient_education,
    patients,
    portal_auth,
    portal_intake,
    prior_auth,
    public_health,
    scheduling,
    sdoh_screening,
    settings as settings_router,
    tasks,
    telehealth,
    users,
    webhooks,
    websocket,
)
from app.services.readiness_service import check_readiness


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_create_schema:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    if settings.ensure_object_storage_on_startup:
        ensure_bucket()
    yield
    await engine.dispose()
    await redis.close()


app = FastAPI(
    title="ConciergeOS API",
    version="0.0.1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.0.1"}


@app.get("/api/ready")
async def readiness_check(
    _current_user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),  # noqa: B008
):
    return await check_readiness()


app.include_router(audit.router)
app.include_router(assistant.router)
app.include_router(analytics.router)
app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(clinical_templates.router)
app.include_router(patients.router)
app.include_router(portal_auth.router)
app.include_router(portal_intake.router)
app.include_router(tasks.router)
app.include_router(users.router)
app.include_router(scheduling.router)
app.include_router(settings_router.router)
app.include_router(faxes.router)
app.include_router(integration_capabilities.router)
app.include_router(integrations.router)
app.include_router(launch_readiness.router)
app.include_router(operations.router)
app.include_router(messages.router)
app.include_router(webhooks.router)
app.include_router(claim_scrubber.router)
app.include_router(clinical_decision_support.router)
app.include_router(clinical_quality_measures.router)
app.include_router(clinical_reconciliation.router)
app.include_router(esignature.router)
app.include_router(emergency_access.router)
app.include_router(family_history.router)
app.include_router(form_builder.router)
app.include_router(immunization_registry.router)
app.include_router(implantable_devices.router)
app.include_router(patient_education.router)
app.include_router(prior_auth.router)
app.include_router(public_health.router)
app.include_router(sdoh_screening.router)
app.include_router(telehealth.router)
app.include_router(mips.router)
app.include_router(amendments.router)

# FHIR API (ONC certification)
from app.integrations.fhir import router as fhir_router
app.include_router(fhir_router)

# PWA endpoints
from app.integrations.pwa import router as pwa_router
app.include_router(pwa_router)

# Patient portal complete
from app.routers.patient_portal_complete import router as portal_complete_router
app.include_router(portal_complete_router)
