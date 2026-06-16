import asyncio
import logging
from datetime import datetime, timezone

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_source_task(self, source_id: str):
    asyncio.run(_process_source(source_id))


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

        chunk_count = await rag_service.index_chunks(source["workspace_id"], chunks)

        await db.sources.update_one(
            {"_id": source_id},
            {
                "$set": {
                    "status": ProcessingStatus.COMPLETED.value,
                    "chunk_count": chunk_count,
                    "page_count": page_count,
                    "word_count": word_count,
                    "metadata.embedding_model": settings.OPENAI_EMBEDDING_MODEL,
                    "metadata.embedding_dimensions": settings.OPENAI_EMBEDDING_DIMENSIONS or "full",
                    "metadata.chroma_collection": rag_service.collection_name(source["workspace_id"]),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        logger.info(f"Source {source_id} processed: {chunk_count} chunks")

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
