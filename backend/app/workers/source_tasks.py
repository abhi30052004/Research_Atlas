import asyncio
import logging
import time
from datetime import datetime, timezone

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_source_task(self, source_id: str):
    asyncio.run(_process_source(source_id))


async def _update_progress(db, source_id: str, stage: str, pct: int):
    """Write granular progress to the database so the frontend can display it."""
    await db.sources.update_one(
        {"_id": source_id},
        {
            "$set": {
                "metadata.progress_stage": stage,
                "metadata.progress_pct": max(0, min(100, pct)),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )


async def _process_source(source_id: str):
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
        {
            "$set": {
                "status": ProcessingStatus.PROCESSING.value,
                "metadata.progress_stage": "extracting",
                "metadata.progress_pct": 5,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    try:
        t0 = time.perf_counter()

        # --- Phase 1: Extract text ---
        source_type = source.get("source_type")
        text = ""
        page_count = None
        chunks = []

        await _update_progress(db, source_id, "extracting", 8)

        if source_type == SourceType.PDF.value:
            pages, page_count = await extract_pages_from_pdf(source["file_path"])
            text = "\n".join(pages)
            await _update_progress(db, source_id, "extracting", 15)
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

        t_extract = time.perf_counter()
        logger.info("Source %s extraction took %.2fs", source_id, t_extract - t0)

        # --- Phase 2: Chunk ---
        word_count = len(text.split()) if text else 0
        await _update_progress(db, source_id, "chunking", 18)
        if not chunks:
            chunks = chunk_text(text, source_id, source["filename"])

        t_chunk = time.perf_counter()
        logger.info(
            "Source %s chunking took %.2fs (%d words -> %d chunks)",
            source_id, t_chunk - t_extract, word_count, len(chunks),
        )

        await _update_progress(db, source_id, "storing_chunks", 25)
        chunk_count = await rag_service.store_source_chunks(source["workspace_id"], source_id, chunks)
        now = datetime.now(timezone.utc)
        t_store = time.perf_counter()
        logger.info("Source %s chunk storage took %.2fs", source_id, t_store - t_chunk)

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
                        "metadata.progress_stage": "embedding",
                        "metadata.progress_pct": 35,
                        "metadata.embedding_model": settings.OPENAI_EMBEDDING_MODEL,
                        "metadata.embedding_dimensions": settings.OPENAI_EMBEDDING_DIMENSIONS or "full",
                        "metadata.chroma_collection": rag_service.collection_name(source["workspace_id"]),
                        "updated_at": now,
                    }
                },
            )

        # --- Phase 3: Embed + Index (the slow part, now parallelized) ---
        async def _progress_cb(stage: str, pct: int):
            await _update_progress(db, source_id, stage, pct)

        try:
            await rag_service.index_chunks(
                source["workspace_id"],
                chunks,
                progress_callback=_progress_cb,
            )
            await db.sources.update_one(
                {"_id": source_id},
                {
                    "$set": {
                        "status": ProcessingStatus.COMPLETED.value,
                        "chunk_count": chunk_count,
                        "page_count": page_count,
                        "word_count": word_count,
                        "metadata.embedding_status": "indexed",
                        "metadata.progress_stage": "completed",
                        "metadata.progress_pct": 100,
                        "metadata.embedding_model": settings.OPENAI_EMBEDDING_MODEL,
                        "metadata.embedding_dimensions": settings.OPENAI_EMBEDDING_DIMENSIONS or "full",
                        "metadata.chroma_collection": rag_service.collection_name(source["workspace_id"]),
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
        except Exception as embedding_error:
            if not settings.SOURCE_FAST_READY_BEFORE_EMBEDDING:
                raise
            logger.warning(f"Embedding index failed for source {source_id}: {embedding_error}")
            await db.sources.update_one(
                {"_id": source_id},
                {
                    "$set": {
                        "metadata.embedding_status": "failed",
                        "metadata.embedding_error": str(embedding_error)[:500],
                        "metadata.progress_stage": "embedding_failed",
                        "metadata.progress_pct": 100,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )

        t_total = time.perf_counter()
        logger.info(
            "Source %s fully processed in %.2fs: %d chunks, %d words",
            source_id, t_total - t0, chunk_count, word_count,
        )

    except Exception as e:
        logger.error(f"Failed to process source {source_id}: {e}")
        await db.sources.update_one(
            {"_id": source_id},
            {
                "$set": {
                    "status": ProcessingStatus.FAILED.value,
                    "error_message": str(e)[:500],
                    "metadata.progress_stage": "failed",
                    "metadata.progress_pct": 0,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        raise
