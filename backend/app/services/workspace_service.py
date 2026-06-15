from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException

from app.core.database import get_db
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


class WorkspaceService:
    async def create(self, data: WorkspaceCreate, user_id: str) -> dict:
        db = get_db()
        workspace_id = str(ObjectId())
        doc = {
            "_id": workspace_id,
            "user_id": user_id,
            "name": data.name,
            "description": data.description,
            "source_count": 0,
            "chat_count": 0,
            "note_count": 0,
            "artifact_count": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.workspaces.insert_one(doc)
        return {**doc, "id": workspace_id}

    async def get_by_id(self, workspace_id: str, user_id: str) -> dict:
        db = get_db()
        ws = await db.workspaces.find_one({"_id": workspace_id, "user_id": user_id})
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")
        ws["id"] = str(ws["_id"])
        return ws

    async def list_by_user(self, user_id: str) -> List[dict]:
        db = get_db()
        cursor = db.workspaces.find({"user_id": user_id}).sort("updated_at", -1)
        results = []
        async for ws in cursor:
            ws["id"] = str(ws["_id"])
            results.append(ws)
        return results

    async def update(self, workspace_id: str, user_id: str, data: WorkspaceUpdate) -> dict:
        db = get_db()
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            return await self.get_by_id(workspace_id, user_id)
        update_data["updated_at"] = datetime.now(timezone.utc)
        result = await db.workspaces.find_one_and_update(
            {"_id": workspace_id, "user_id": user_id},
            {"$set": update_data},
            return_document=True,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Workspace not found")
        result["id"] = str(result["_id"])
        return result

    async def delete(self, workspace_id: str, user_id: str) -> None:
        db = get_db()
        result = await db.workspaces.delete_one({"_id": workspace_id, "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Workspace not found")
        await db.sources.delete_many({"workspace_id": workspace_id})
        await db.chats.delete_many({"workspace_id": workspace_id})
        await db.notes.delete_many({"workspace_id": workspace_id})
        await db.artifacts.delete_many({"workspace_id": workspace_id})

    async def increment_count(self, workspace_id: str, field: str, amount: int = 1) -> None:
        db = get_db()
        await db.workspaces.update_one(
            {"_id": workspace_id},
            {"$inc": {field: amount}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )


workspace_service = WorkspaceService()
