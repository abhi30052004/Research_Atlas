from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId

from app.core.database import get_db
from app.models.analytics import EventType


class AnalyticsService:
    async def track(
        self,
        user_id: str,
        event_type: EventType,
        workspace_id: Optional[str] = None,
        model_used: Optional[str] = None,
        tokens_used: int = 0,
        metadata: dict = None,
    ) -> None:
        db = get_db()
        await db.analytics.insert_one({
            "_id": str(ObjectId()),
            "user_id": user_id,
            "workspace_id": workspace_id,
            "event_type": event_type.value,
            "model_used": model_used,
            "tokens_used": tokens_used or 0,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        })

    async def get_dashboard(self, user_id: str, days: int = 30) -> dict:
        db = get_db()
        since = datetime.now(timezone.utc) - timedelta(days=days)

        pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": since}}},
            {"$group": {
                "_id": "$event_type",
                "count": {"$sum": 1},
                "total_tokens": {"$sum": "$tokens_used"},
            }},
        ]
        event_stats = {}
        async for doc in db.analytics.aggregate(pipeline):
            event_stats[doc["_id"]] = {"count": doc["count"], "total_tokens": doc["total_tokens"]}

        token_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": since}}},
            {"$group": {"_id": "$model_used", "count": {"$sum": 1}, "tokens": {"$sum": "$tokens_used"}}},
        ]
        model_stats = []
        async for doc in db.analytics.aggregate(token_pipeline):
            if doc["_id"]:
                model_stats.append({"model": doc["_id"], "requests": doc["count"], "tokens": doc["tokens"]})

        daily_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": since}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1},
                "tokens": {"$sum": "$tokens_used"},
            }},
            {"$sort": {"_id": 1}},
        ]
        daily_stats = []
        async for doc in db.analytics.aggregate(daily_pipeline):
            daily_stats.append({"date": doc["_id"], "count": doc["count"], "tokens": doc["tokens"]})

        return {
            "period_days": days,
            "event_breakdown": event_stats,
            "model_usage": model_stats,
            "daily_activity": daily_stats,
            "totals": {
                "ai_requests": event_stats.get(EventType.AI_REQUEST.value, {}).get("count", 0),
                "tokens_consumed": sum(e.get("total_tokens", 0) for e in event_stats.values()),
                "sources_uploaded": event_stats.get(EventType.SOURCE_UPLOAD.value, {}).get("count", 0),
                "chats_created": event_stats.get(EventType.CHAT_CREATED.value, {}).get("count", 0),
                "artifacts_generated": event_stats.get(EventType.ARTIFACT_GENERATED.value, {}).get("count", 0),
            },
        }


analytics_service = AnalyticsService()
