import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_source_task(self, source_id: str):
    try:
        asyncio.run(_process_source(source_id, detach_embedding=False, enqueue_embedding=True))
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def index_source_task(self, source_id: str):
    try:
        asyncio.run(_index_source(source_id, raise_on_error=True))
    except Exception as exc:
        raise self.retry(exc=exc)


def _log_detached_index_result(task: asyncio.Task) -> None:
    try:
        task.result()
    except Exception:
        logger.exception("Detached source embedding index failed")


async def _load_chunks_from_db(db, source_id: str) -> List[Dict[str, Any]]:
    chunks = []
    cursor = db.source_chunks.find({"source_id": source_id}).sort("chunk_index", 1)
    async for chunk in cursor:
        chunks.append(_chunk_from_document(chunk))
    return chunks


def _chunk_from_document(chunk: Dict[str, Any]) -> Dict[str, Any]:
    chunk_id = chunk.get("chunk_id") or str(chunk.get("_id"))
    metadata = chunk.get("metadata", {})
    return {
        "chunk_id": chunk_id,
        "content": chunk.get("content", ""),
        "metadata": {
            **metadata,
            "source_id": chunk.get("source_id") or metadata.get("source_id"),
            "filename": chunk.get("filename") or metadata.get("filename"),
            "page_number": chunk.get("page_number") or metadata.get("page_number"),
            "chunk_index": chunk.get("chunk_index", metadata.get("chunk_index", 0)),
        },
    }


async def _iter_chunk_batches_from_db(db, source_id: str, batch_size: int):
    batch_size = max(1, batch_size)
    batch = []
    cursor = db.source_chunks.find({"source_id": source_id}).sort("chunk_index", 1)
    async for chunk in cursor:
        batch.append(_chunk_from_document(chunk))
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


async def _index_source(
    source_id: str,
    chunks: Optional[List[Dict[str, Any]]] = None,
    fail_source_on_error: bool = False,
    raise_on_error: bool = False,
) -> None:
    from app.core.database import connect_db, get_db
    from app.services.rag_service import rag_service
    from app.models.source import ProcessingStatus
    from app.core.config import settings

    try:
        db = get_db()
    except RuntimeError:
        await connect_db()
        db = get_db()

    source = await db.sources.find_one({"_id": source_id})
    if not source:
        logger.info("Skipping embedding index for missing source %s", source_id)
        return

    now = datetime.now(timezone.utc)
    await db.sources.update_one(
        {"_id": source_id},
        {
            "$set": {
                "metadata.embedding_status": "indexing",
                "metadata.embedding_model": settings.OPENAI_EMBEDDING_MODEL,
                "metadata.embedding_dimensions": settings.OPENAI_EMBEDDING_DIMENSIONS or "full",
                "metadata.chroma_collection": rag_service.collection_name(source["workspace_id"]),
                "updated_at": now,
            }
        },
    )

    try:
        if chunks is None:
            indexed_count = await rag_service.index_chunk_batches(
                source["workspace_id"],
                _iter_chunk_batches_from_db(db, source_id, settings.SOURCE_INDEX_DB_BATCH_SIZE),
            )
        elif chunks:
            indexed_count = await rag_service.index_chunks(source["workspace_id"], chunks)
        else:
            indexed_count = 0
        await db.sources.update_one(
            {"_id": source_id},
            {
                "$set": {
                    "status": ProcessingStatus.COMPLETED.value,
                    "chunk_count": indexed_count,
                    "metadata.embedding_status": "indexed",
                    "metadata.embedding_model": settings.OPENAI_EMBEDDING_MODEL,
                    "metadata.embedding_dimensions": settings.OPENAI_EMBEDDING_DIMENSIONS or "full",
                    "metadata.chroma_collection": rag_service.collection_name(source["workspace_id"]),
                    "updated_at": datetime.now(timezone.utc),
                },
                "$unset": {"metadata.embedding_error": ""},
            },
        )
    except Exception as embedding_error:
        logger.warning("Embedding index failed for source %s: %s", source_id, embedding_error)
        update_doc = {
            "$set": {
                "metadata.embedding_status": "failed",
                "metadata.embedding_error": str(embedding_error)[:500],
                "updated_at": datetime.now(timezone.utc),
            }
        }
        if fail_source_on_error:
            update_doc["$set"]["status"] = ProcessingStatus.FAILED.value
            update_doc["$set"]["error_message"] = str(embedding_error)[:500]
        await db.sources.update_one({"_id": source_id}, update_doc)
        if fail_source_on_error or raise_on_error:
            raise


async def _schedule_index_source(
    source_id: str,
    detach_embedding: bool,
    enqueue_embedding: bool,
) -> None:
    from app.core.config import settings

    if not settings.SOURCE_DETACH_EMBEDDING_INDEX:
        await _index_source(source_id)
        return

    if not enqueue_embedding:
        if detach_embedding:
            task = asyncio.create_task(_index_source(source_id))
            task.add_done_callback(_log_detached_index_result)
        else:
            await _index_source(source_id)
        return

    try:
        await asyncio.to_thread(index_source_task.delay, source_id)
        logger.info("Queued source %s for embedding index", source_id)
    except Exception as exc:
        logger.warning("Embedding enqueue failed for source %s: %s", source_id, exc)
        if detach_embedding:
            task = asyncio.create_task(_index_source(source_id))
            task.add_done_callback(_log_detached_index_result)
        else:
            await _index_source(source_id)


async def _process_source(
    source_id: str,
    detach_embedding: bool = True,
    enqueue_embedding: bool = True,
):
    from app.core.database import connect_db, get_db
    from app.utils.extractors import (
        extract_pages_from_pdf,
        extract_text_from_docx,
        extract_text_from_txt,
        extract_text_from_csv,
        extract_text_from_xlsx,
        extract_text_from_pptx,
        extract_text_from_url,
    )
    from app.utils.chunking import chunk_text, chunk_text_with_pages
    from app.services.rag_service import rag_service
    from app.models.source import ProcessingStatus, SourceType
    from app.core.config import settings

    try:
        db = get_db()
    except RuntimeError:
        await connect_db()
        db = get_db()

    source = await db.sources.find_one({"_id": source_id})
    if not source:
        logger.error(f"Source {source_id} not found")
        return

    await db.sources.update_one(
        {"_id": source_id},
        {"$set": {"status": ProcessingStatus.PROCESSING.value, "updated_at": datetime.now(timezone.utc)}},
    )

    try:
        source_type = source.get("source_type")
        text = ""
        page_count = None
        chunks = []

        if source_type == SourceType.PDF.value:
            pages, page_count = await extract_pages_from_pdf(source["file_path"])
            text = "\n".join(pages)
            chunks = chunk_text_with_pages(pages, source_id, source["filename"])
        elif source_type == SourceType.DOCX.value:
            text = await extract_text_from_docx(source["file_path"])
        elif source_type == SourceType.TXT.value:
            text = await extract_text_from_txt(source["file_path"])
        elif source_type == SourceType.CSV.value:
            text = await extract_text_from_csv(source["file_path"])
        elif source_type == SourceType.XLSX.value:
            text = await extract_text_from_xlsx(source["file_path"])
        elif source_type == SourceType.PPTX.value:
            text = await extract_text_from_pptx(source["file_path"])
        elif source_type == SourceType.URL.value:
            text = await extract_text_from_url(source["url"])

        word_count = len(text.split()) if text else 0
        if not chunks:
            chunks = chunk_text(text, source_id, source["filename"])

        chunk_count = await rag_service.store_source_chunks(source["workspace_id"], source_id, chunks)
        now = datetime.now(timezone.utc)

        if settings.SOURCE_FAST_READY_BEFORE_EMBEDDING:
            await db.sources.update_one(
                {"_id": source_id},
                {
                    "$set": {
                        "status": ProcessingStatus.COMPLETED.value,
                        "chunk_count": chunk_count,
                        "page_count": page_count,
                        "word_count": word_count,
                        "metadata.embedding_status": "indexing",
                        "metadata.embedding_model": settings.OPENAI_EMBEDDING_MODEL,
                        "metadata.embedding_dimensions": settings.OPENAI_EMBEDDING_DIMENSIONS or "full",
                        "metadata.chroma_collection": rag_service.collection_name(source["workspace_id"]),
                        "updated_at": now,
                    }
                },
            )
            await _schedule_index_source(source_id, detach_embedding, enqueue_embedding)
        else:
            await _index_source(source_id, chunks, fail_source_on_error=True)
            await db.sources.update_one(
                {"_id": source_id},
                {
                    "$set": {
                        "chunk_count": chunk_count,
                        "page_count": page_count,
                        "word_count": word_count,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )

        logger.info(f"Source {source_id} text-ready: {chunk_count} chunks")

    except Exception as e:
        logger.error(f"Failed to process source {source_id}: {e}")
        await db.sources.update_one(
            {"_id": source_id},
            {
                "$set": {
                    "status": ProcessingStatus.FAILED.value,
                    "error_message": str(e)[:500],
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        raise
