from fastapi import APIRouter
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.redis import get_redis

router = APIRouter()


@router.get("/health")
async def health_check():
    status = {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat(), "services": {}}

    try:
        db = get_db()
        await db.command("ping")
        status["services"]["mongodb"] = "ok"
    except Exception as e:
        status["services"]["mongodb"] = f"error: {e}"
        status["status"] = "degraded"

    try:
        redis = get_redis()
        if redis:
            await redis.ping()
            status["services"]["redis"] = "ok"
        else:
            status["services"]["redis"] = "not configured"
    except Exception as e:
        status["services"]["redis"] = f"error: {e}"

    return status
