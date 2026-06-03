import redis.asyncio as aioredis
from app.config import settings

redis = aioredis.from_url(settings.redis_url, decode_responses=True)


async def get_redis() -> aioredis.Redis:  # type: ignore[misc]
    return redis
