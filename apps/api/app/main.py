from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.redis_client import redis
from app.minio_client import ensure_bucket


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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


from app.routers import auth, patients, tasks, scheduling, faxes, messages

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(tasks.router)
app.include_router(scheduling.router)
app.include_router(faxes.router)
app.include_router(messages.router)
