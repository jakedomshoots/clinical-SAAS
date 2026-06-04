from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, async_session_factory, engine
from app.minio_client import ensure_bucket
from app.redis_client import redis
from app.routers import (
    assistant,
    audit,
    auth,
    faxes,
    messages,
    patients,
    scheduling,
    tasks,
    websocket,
)
from app.services.auth_service import seed_admin
from app.services.readiness_service import check_readiness


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed admin user on first boot
    async with async_session_factory() as db:
        await seed_admin(db)

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
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(tasks.router)
app.include_router(scheduling.router)
app.include_router(faxes.router)
app.include_router(messages.router)
app.include_router(websocket.router)
