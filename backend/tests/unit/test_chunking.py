import pytest
from app.utils.chunking import chunk_text


def test_chunk_text_basic():
    text = "Hello world. " * 200
    chunks = chunk_text(text, "source_1", "test.txt")
    assert len(chunks) > 0
    assert all("chunk_id" in c for c in chunks)
    assert all("content" in c for c in chunks)
    assert all("metadata" in c for c in chunks)


def test_chunk_text_metadata():
    text = "Sample text. " * 100
    chunks = chunk_text(text, "source_abc", "document.pdf")
    for chunk in chunks:
        assert chunk["metadata"]["source_id"] == "source_abc"
        assert chunk["metadata"]["filename"] == "document.pdf"


def test_chunk_text_ids_unique():
    text = "Some content here. " * 300
    chunks = chunk_text(text, "src_1", "file.txt")
    ids = [c["chunk_id"] for c in chunks]
    assert len(ids) == len(set(ids))


def test_chunk_text_short():
    text = "Short text"
    chunks = chunk_text(text, "src_x", "short.txt")
    assert len(chunks) == 1
    assert chunks[0]["content"] == "Short text"


def test_chunk_text_empty():
    chunks = chunk_text("", "src_empty", "empty.txt")
    assert chunks == []
