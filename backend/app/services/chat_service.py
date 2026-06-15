import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
from bson import ObjectId
from fastapi import HTTPException

from app.core.database import get_db
from app.core.config import settings
from app.core.security import detect_prompt_injection
from app.langgraph.agent import run_agent
from app.models.analytics import EventType
from app.services.analytics_service import analytics_service

logger = logging.getLogger(__name__)


class ChatService:
    async def create_chat(self, workspace_id: str, user_id: str, model: str = "gpt-4o", title: Optional[str] = None) -> dict:
        db = get_db()
        ws = await db.workspaces.find_one({"_id": workspace_id, "user_id": user_id})
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")

        chat_id = str(ObjectId())
        doc = {
            "_id": chat_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "title": title,
            "messages": [],
            "model": model,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.chats.insert_one(doc)
        await db.workspaces.update_one(
            {"_id": workspace_id},
            {"$inc": {"chat_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        await analytics_service.track(user_id, EventType.CHAT_CREATED, workspace_id)
        doc["id"] = chat_id
        return doc

    async def get_chat(self, chat_id: str, user_id: str) -> dict:
        db = get_db()
        chat = await db.chats.find_one({"_id": chat_id, "user_id": user_id})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        chat["id"] = str(chat["_id"])
        return chat

    async def list_chats(self, workspace_id: str, user_id: str) -> list:
        db = get_db()
        cursor = db.chats.find(
            {"workspace_id": workspace_id, "user_id": user_id},
            {"messages": 0},
        ).sort("updated_at", -1)
        chats = []
        async for c in cursor:
            c["id"] = str(c["_id"])
            chats.append(c)
        return chats

    async def delete_chat(self, chat_id: str, user_id: str) -> None:
        db = get_db()
        chat = await db.chats.find_one({"_id": chat_id, "user_id": user_id})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        await db.chats.delete_one({"_id": chat_id})
        await db.workspaces.update_one(
            {"_id": chat["workspace_id"]},
            {"$inc": {"chat_count": -1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )

    async def send_message_stream(
        self,
        chat_id: str,
        user_id: str,
        content: str,
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        db = get_db()
        chat = await db.chats.find_one({"_id": chat_id, "user_id": user_id})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        if detect_prompt_injection(content):
            yield f"data: {json.dumps({'type': 'error', 'content': 'Message blocked: potential prompt injection detected.', 'done': True})}\n\n"
            return

        user_msg_id = str(ObjectId())
        user_msg = {
            "id": user_msg_id,
            "role": "user",
            "content": content,
            "citations": [],
            "followup_suggestions": [],
            "model_used": None,
            "tokens_used": None,
            "created_at": datetime.now(timezone.utc),
        }
        await db.chats.update_one(
            {"_id": chat_id},
            {"$push": {"messages": user_msg}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )

        yield f"data: {json.dumps({'type': 'start', 'content': '', 'done': False})}\n\n"

        effective_model = model or chat.get("model", settings.OPENAI_DEFAULT_MODEL)
        try:
            result = await run_agent(
                query=content,
                workspace_id=chat["workspace_id"],
                user_id=user_id,
                model=effective_model,
            )
            response_text = result["response"]
            citations = result["citations"]
            followups = result["followups"]
            tokens_used = result.get("tokens_used", 0)

            chunk_size = 50
            for i in range(0, len(response_text), chunk_size):
                chunk = response_text[i: i + chunk_size]
                yield f"data: {json.dumps({'type': 'token', 'content': chunk, 'done': False})}\n\n"

            assistant_msg_id = str(ObjectId())
            assistant_msg = {
                "id": assistant_msg_id,
                "role": "assistant",
                "content": response_text,
                "citations": citations,
                "followup_suggestions": followups,
                "model_used": effective_model,
                "tokens_used": tokens_used,
                "created_at": datetime.now(timezone.utc),
            }
            await db.chats.update_one(
                {"_id": chat_id},
                {"$push": {"messages": assistant_msg}, "$set": {"updated_at": datetime.now(timezone.utc)}},
            )

            if not chat.get("title"):
                title = content[:50] + ("..." if len(content) > 50 else "")
                await db.chats.update_one({"_id": chat_id}, {"$set": {"title": title}})

            await analytics_service.track(
                user_id, EventType.AI_REQUEST, chat["workspace_id"],
                model_used=effective_model, tokens_used=tokens_used,
            )

            yield f"data: {json.dumps({'type': 'done', 'content': '', 'citations': citations, 'followups': followups, 'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': 'An error occurred. Please try again.', 'done': True})}\n\n"

    async def regenerate_message(
        self, chat_id: str, user_id: str, message_id: str, model: Optional[str] = None
    ) -> dict:
        db = get_db()
        chat = await db.chats.find_one({"_id": chat_id, "user_id": user_id})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        messages = chat.get("messages", [])
        msg_index = next((i for i, m in enumerate(messages) if m["id"] == message_id), None)
        if msg_index is None:
            raise HTTPException(status_code=404, detail="Message not found")

        prev_user_msg = None
        for m in reversed(messages[:msg_index]):
            if m["role"] == "user":
                prev_user_msg = m
                break
        if not prev_user_msg:
            raise HTTPException(status_code=400, detail="No user message to regenerate from")

        effective_model = model or chat.get("model", settings.OPENAI_DEFAULT_MODEL)
        result = await run_agent(
            query=prev_user_msg["content"],
            workspace_id=chat["workspace_id"],
            user_id=user_id,
            model=effective_model,
        )

        updated_msg = {
            **messages[msg_index],
            "content": result["response"],
            "citations": result["citations"],
            "followup_suggestions": result["followups"],
            "model_used": effective_model,
            "tokens_used": result.get("tokens_used", 0),
            "created_at": datetime.now(timezone.utc),
        }
        messages[msg_index] = updated_msg
        await db.chats.update_one(
            {"_id": chat_id},
            {"$set": {"messages": messages, "updated_at": datetime.now(timezone.utc)}},
        )
        return updated_msg


chat_service = ChatService()
