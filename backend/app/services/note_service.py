from datetime import datetime, timezone
from typing import List
from bson import ObjectId
from fastapi import HTTPException

from app.core.database import get_db
from app.schemas.note import NoteCreate, NoteUpdate


class NoteService:
    async def create(self, data: NoteCreate, user_id: str) -> dict:
        db = get_db()
        ws = await db.workspaces.find_one({"_id": data.workspace_id, "user_id": user_id})
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")

        word_count = len((data.content_text or "").split()) if data.content_text else 0
        note_id = str(ObjectId())
        doc = {
            "_id": note_id,
            "workspace_id": data.workspace_id,
            "user_id": user_id,
            "title": data.title,
            "content_json": data.content_json,
            "content_html": data.content_html,
            "content_text": data.content_text,
            "attached_sources": data.attached_sources,
            "tags": data.tags,
            "is_pinned": False,
            "word_count": word_count,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.notes.insert_one(doc)
        await db.workspaces.update_one(
            {"_id": data.workspace_id},
            {"$inc": {"note_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        doc["id"] = note_id
        return doc

    async def get_by_id(self, note_id: str, user_id: str) -> dict:
        db = get_db()
        note = await db.notes.find_one({"_id": note_id, "user_id": user_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        note["id"] = str(note["_id"])
        return note

    async def list_by_workspace(self, workspace_id: str, user_id: str) -> List[dict]:
        db = get_db()
        ws = await db.workspaces.find_one({"_id": workspace_id, "user_id": user_id})
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")
        cursor = db.notes.find({"workspace_id": workspace_id, "user_id": user_id}).sort(
            [("is_pinned", -1), ("updated_at", -1)]
        )
        notes = []
        async for n in cursor:
            n["id"] = str(n["_id"])
            notes.append(n)
        return notes

    async def update(self, note_id: str, user_id: str, data: NoteUpdate) -> dict:
        db = get_db()
        update = {k: v for k, v in data.model_dump().items() if v is not None}
        if "content_text" in update:
            update["word_count"] = len(update["content_text"].split())
        update["updated_at"] = datetime.now(timezone.utc)
        result = await db.notes.find_one_and_update(
            {"_id": note_id, "user_id": user_id},
            {"$set": update},
            return_document=True,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Note not found")
        result["id"] = str(result["_id"])
        return result

    async def delete(self, note_id: str, user_id: str) -> None:
        db = get_db()
        note = await db.notes.find_one({"_id": note_id, "user_id": user_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        await db.notes.delete_one({"_id": note_id})
        await db.workspaces.update_one(
            {"_id": note["workspace_id"]},
            {"$inc": {"note_count": -1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )


note_service = NoteService()
