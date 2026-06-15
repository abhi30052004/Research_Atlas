import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_chunk_and_embed_pipeline():
    from app.utils.chunking import chunk_text
    text = "Artificial intelligence is transforming the world. " * 50
    chunks = chunk_text(text, "test_source_id", "test_doc.txt")
    assert len(chunks) >= 1
    for chunk in chunks:
        assert chunk["content"]
        assert chunk["metadata"]["source_id"] == "test_source_id"


@pytest.mark.asyncio
async def test_rag_service_retrieve_empty():
    from app.services.rag_service import rag_service
    with patch.object(rag_service, "_get_chroma") as mock_chroma:
        mock_collection = AsyncMock()
        mock_collection.query = AsyncMock(
            return_value={
                "documents": [[]],
                "metadatas": [[]],
                "distances": [[]],
                "ids": [[]],
            }
        )
        mock_client = AsyncMock()
        mock_client.get_collection = AsyncMock(return_value=mock_collection)
        mock_chroma.return_value = mock_client

        with patch.object(rag_service, "embed_texts", AsyncMock(return_value=[[0.1] * 10])):
            results = await rag_service.retrieve("workspace_test", "test query", top_k=5)
    assert results == []


@pytest.mark.asyncio
async def test_rag_service_index_chunks():
    from app.services.rag_service import rag_service
    chunks = [
        {
            "chunk_id": "src_chunk_0",
            "content": "Sample content for embedding",
            "metadata": {"source_id": "src", "filename": "test.pdf", "chunk_index": 0},
        }
    ]
    with patch.object(rag_service, "_get_chroma") as mock_chroma:
        mock_collection = AsyncMock()
        mock_collection.add = AsyncMock()
        mock_client = AsyncMock()
        mock_client.get_or_create_collection = AsyncMock(return_value=mock_collection)
        mock_chroma.return_value = mock_client

        with patch.object(rag_service, "embed_texts", AsyncMock(return_value=[[0.1] * 10])):
            count = await rag_service.index_chunks("workspace_123", chunks)
    assert count == 1
