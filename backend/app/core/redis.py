from typing import Optional
import redis.asyncio as aioredis
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client: Optional[aioredis.Redis] = None


async def connect_redis() -> None:
    global redis_client
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        await redis_client.ping()
        logger.info("Connected to Redis")
    except Exception as e:
        logger.warning(f"Redis not available: {e}. Rate limiting disabled.")
        redis_client = None


async def disconnect_redis() -> None:
    global redis_client
    if redis_client:
        await redis_client.close()
        logger.info("Disconnected from Redis")


def get_redis() -> Optional[aioredis.Redis]:
    return redis_client


async def cache_set(key: str, value: str, expire: int = 300) -> None:
    if redis_client:
        await redis_client.setex(key, expire, value)


async def cache_get(key: str) -> Optional[str]:
    if redis_client:
        return await redis_client.get(key)
    return None


async def cache_delete(key: str) -> None:
    if redis_client:
        await redis_client.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    if redis_client:
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)
