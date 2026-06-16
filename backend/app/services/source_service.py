import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import BackgroundTasks, HTTPException, UploadFile

from app.core.config import settings
from app.core.database import get_db
from app.models.source import ProcessingStatus, SourceType
from app.utils.file_utils import save_upload_file, delete_file
from app.workers.source_tasks import process_source_task

logger = logging.getLogger(__name__)


class SourceService:
    async def _enqueue_processing(self, source_id: str) -> None:
        try:
            from app.core.redis import redis_client

            if redis_client is None:
                raise RuntimeError("Redis/Celery broker is not connected")
            await asyncio.to_thread(process_source_task.delay, source_id)
            logger.info("Queued source %s for Celery processing", source_id)
        except Exception as exc:
            logger.warning(
                "Celery enqueue failed for source %s; processing in API background task: %s",
                source_id,
                exc,
            )
            from app.workers.source_tasks import _process_source
            try:
                await _process_source(source_id)
            except Exception:
                logger.exception("API fallback processing failed for source %s", source_id)

    def _schedule_processing(
        self,
        source_id: str,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> None:
        if background_tasks is not None:
            background_tasks.add_task(self._enqueue_processing, source_id)
            return

        asyncio.create_task(self._enqueue_processing(source_id))

    def _source_age_seconds(self, source: dict) -> float:
        updated_at = source.get("updated_at") or source.get("created_at")
        if not updated_at:
            return 0
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - updated_at).total_seconds()

    def _is_stale_for_requeue(self, source: dict) -> bool:
        status = source.get("status")
        age = self._source_age_seconds(source)
        if status == ProcessingStatus.PENDING.value:
            return age > settings.STALE_PENDING_REQUEUE_SECONDS
        if status == ProcessingStatus.PROCESSING.value:
            return age > settings.STALE_PROCESSING_REQUEUE_SECONDS
        return False

    async def _requeue_stale_sources(self, sources: List[dict]) -> None:
        stale_sources = [source for source in sources if self._is_stale_for_requeue(source)]
        if not stale_sources:
            return

        db = get_db()
        now = datetime.now(timezone.utc)
        for source in stale_sources:
            source_id = str(source["_id"])
            result = await db.sources.update_one(
                {"_id": source_id, "status": source["status"]},
                {
                    "$set": {
                        "status": ProcessingStatus.PENDING.value,
                        "updated_at": now,
                        "metadata.requeued_at": now.isoformat(),
                    }
                },
            )
            if result.matched_count:
                source["status"] = ProcessingStatus.PENDING.value
                source["updated_at"] = now
                self._schedule_processing(source_id)

    async def upload_file(
        self,
        file: UploadFile,
        workspace_id: str,
        user_id: str,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> dict:
        db = get_db()
        ws = await db.workspaces.find_one({"_id": workspace_id, "user_id": user_id})
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")

        file_info = await save_upload_file(file, workspace_id)
        ext = file_info["extension"]
        source_type_map = {
            "pdf": SourceType.PDF, "docx": SourceType.DOCX, "txt": SourceType.TXT,
            "csv": SourceType.CSV, "xlsx": SourceType.XLSX, "pptx": SourceType.PPTX,
        }
        source_type = source_type_map.get(ext, SourceType.TXT)

        source_id = str(ObjectId())
        doc = {
            "_id": source_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "filename": file_info["filename"],
            "original_name": file_info["original_name"],
            "source_type": source_type.value,
            "file_path": file_info["file_path"],
            "file_size": file_info["file_size"],
            "mime_type": file_info["mime_type"],
            "status": ProcessingStatus.PENDING.value,
            "chunk_count": 0,
            "chroma_collection": f"workspace_{workspace_id}",
            "metadata": {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.sources.insert_one(doc)
        await db.workspaces.update_one(
            {"_id": workspace_id},
            {"$inc": {"source_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        self._schedule_processing(source_id, background_tasks)
        doc["id"] = source_id
        return doc

    async def add_url(
        self,
        url: str,
        workspace_id: str,
        user_id: str,
        name: Optional[str] = None,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> dict:
        db = get_db()
        ws = await db.workspaces.find_one({"_id": workspace_id, "user_id": user_id})
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")

        source_id = str(ObjectId())
        display_name = name or url[:80]
        doc = {
            "_id": source_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "filename": display_name,
            "original_name": display_name,
            "source_type": SourceType.URL.value,
            "url": url,
            "status": ProcessingStatus.PENDING.value,
            "chunk_count": 0,
            "chroma_collection": f"workspace_{workspace_id}",
            "metadata": {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.sources.insert_one(doc)
        await db.workspaces.update_one(
            {"_id": workspace_id},
            {"$inc": {"source_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        self._schedule_processing(source_id, background_tasks)
        doc["id"] = source_id
        return doc

    async def get_by_id(self, source_id: str, user_id: str) -> dict:
        db = get_db()
        source = await db.sources.find_one({"_id": source_id, "user_id": user_id})
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        source["id"] = str(source["_id"])
        return source

    async def list_by_workspace(
        self, workspace_id: str, user_id: str, page: int = 1, page_size: int = 20
    ) -> dict:
        db = get_db()
        ws = await db.workspaces.find_one({"_id": workspace_id, "user_id": user_id})
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")
        skip = (page - 1) * page_size
        total = await db.sources.count_documents({"workspace_id": workspace_id})
        cursor = db.sources.find({"workspace_id": workspace_id}).sort("created_at", -1).skip(skip).limit(page_size)
        sources = []
        async for src in cursor:
            src["id"] = str(src["_id"])
            sources.append(src)
        await self._requeue_stale_sources(sources)
        return {"sources": sources, "total": total, "page": page, "page_size": page_size}

    async def delete(self, source_id: str, user_id: str) -> None:
        db = get_db()
        source = await db.sources.find_one({"_id": source_id, "user_id": user_id})
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        await db.sources.delete_one({"_id": source_id})
        if source.get("file_path"):
            delete_file(source["file_path"])
        workspace_id = source["workspace_id"]
        await db.workspaces.update_one(
            {"_id": workspace_id},
            {"$inc": {"source_count": -1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        from app.services.rag_service import rag_service
        await rag_service.delete_source_chunks(workspace_id, source_id)


source_service = SourceService()
