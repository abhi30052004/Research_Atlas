from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None


async def connect_db() -> None:
    global client, db
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.MONGODB_DB_NAME]
        await client.admin.command("ping")
        await _create_indexes()
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


async def disconnect_db() -> None:
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


def get_db() -> AsyncIOMotorDatabase:
    if db is None:
        raise RuntimeError("Database not connected")
    return db


async def _create_indexes() -> None:
    database = get_db()

    await database.users.create_index("email", unique=True)
    await database.users.create_index("username", unique=True)

    await database.workspaces.create_index("user_id")
    await database.workspaces.create_index([("name", "text"), ("description", "text")])

    await database.sources.create_index("workspace_id")
    await database.sources.create_index("user_id")
    await database.sources.create_index([("filename", "text"), ("original_name", "text")])

    await database.chats.create_index("workspace_id")
    await database.chats.create_index("user_id")
    await database.chats.create_index([("messages.content", "text")])

    await database.notes.create_index("workspace_id")
    await database.notes.create_index("user_id")
    await database.notes.create_index([("title", "text"), ("content_html", "text")])

    await database.artifacts.create_index("workspace_id")
    await database.artifacts.create_index("user_id")
    await database.artifacts.create_index([("title", "text"), ("content", "text")])

    await database.analytics.create_index("user_id")
    await database.analytics.create_index("created_at")

    await database.refresh_tokens.create_index("token", unique=True)
    await database.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)

    await database.password_reset_tokens.create_index("token", unique=True)
    await database.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)

    logger.info("Database indexes created")
