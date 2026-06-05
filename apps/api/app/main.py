from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.minio_client import ensure_bucket
from app.redis_client import redis
from app.routers import (
    analytics,
    assistant,
    audit,
    auth,
    billing,
    clinical_templates,
    faxes,
    integration_capabilities,
    integrations,
    launch_readiness,
    messages,
    patients,
    portal_auth,
    portal_intake,
    scheduling,
    settings as settings_router,
    tasks,
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
async def readiness_check():
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
app.include_router(messages.router)
app.include_router(webhooks.router)
app.include_router(websocket.router)
