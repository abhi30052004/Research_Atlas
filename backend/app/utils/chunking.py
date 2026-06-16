from typing import List, Dict, Any
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

    result = []
    chunk_idx = 0
    for page_num, page_text in enumerate(pages, 1):
        if not page_text.strip():
            continue
        chunks = splitter.split_text(page_text)
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            result.append(
                {
                    "chunk_id": f"{source_id}_chunk_{chunk_idx}",
                    "content": chunk,
                    "metadata": {
                        "source_id": source_id,
                        "filename": filename,
                        "page_number": page_num,
                        "chunk_index": chunk_idx,
                    },
                }
            )
            chunk_idx += 1
    for chunk in result:
        chunk["metadata"]["chunk_total"] = len(result)
    return result
