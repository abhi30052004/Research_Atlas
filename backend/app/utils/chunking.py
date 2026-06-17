from typing import List, Dict, Any
from bisect import bisect_right
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

from app.core.config import settings


def chunk_text(
    text: str,
    source_id: str,
    filename: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
) -> List[Dict[str, Any]]:
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = splitter.split_text(text)
    result = []
    for i, chunk in enumerate(chunks):
        chunk = chunk.strip()
        if not chunk:
            continue
        result.append(
            {
                "chunk_id": f"{source_id}_chunk_{i}",
                "content": chunk,
                "metadata": {
                    "source_id": source_id,
                    "filename": filename,
                    "chunk_index": i,
                    "chunk_total": len(chunks),
                },
            }
        )
    return result


def chunk_text_with_pages(
    pages: List[str],
    source_id: str,
    filename: str,
) -> List[Dict[str, Any]]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    page_offsets = []
    full_text_parts = []
    cursor = 0
    for page_text in pages:
        page_offsets.append(cursor)
        full_text_parts.append(page_text)
        cursor += len(page_text) + 2

    full_text = "\n\n".join(full_text_parts)
    split_chunks = splitter.split_text(full_text)
    result = []
    search_from = 0

    for chunk_idx, chunk in enumerate(split_chunks):
        chunk = chunk.strip()
        if not chunk:
            continue

        chunk_start = full_text.find(chunk, search_from)
        if chunk_start == -1:
            chunk_start = full_text.find(chunk)
        if chunk_start == -1:
            chunk_start = search_from
        chunk_end = chunk_start + len(chunk)
        search_from = chunk_end

        start_page = max(1, bisect_right(page_offsets, chunk_start))
        end_page = max(start_page, bisect_right(page_offsets, chunk_end))
        metadata = {
            "source_id": source_id,
            "filename": filename,
            "page_number": start_page,
            "page_start": start_page,
            "chunk_index": len(result),
        }
        if end_page != start_page:
            metadata["page_end"] = end_page

        result.append(
            {
                "chunk_id": f"{source_id}_chunk_{len(result)}",
                "content": chunk,
                "metadata": metadata,
            }
        )

    for chunk in result:
        chunk["metadata"]["chunk_total"] = len(result)
    return result
