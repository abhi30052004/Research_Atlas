import pytest
from types import SimpleNamespace
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


@pytest.mark.asyncio
async def test_embed_texts_batches_requests():
    from app.core.config import settings
    from app.services.rag_service import rag_service

    async def fake_create(model, input):
        return SimpleNamespace(
            data=[
                SimpleNamespace(index=index, embedding=[float(len(text))])
                for index, text in enumerate(input)
            ]
        )

    mock_client = MagicMock()
    mock_client.embeddings.create = AsyncMock(side_effect=fake_create)

    with patch.object(rag_service, "_get_openai", return_value=mock_client):
        with patch.object(settings, "EMBEDDING_BATCH_SIZE", 2):
            embeddings = await rag_service.embed_texts(["a", "bb", "ccc", "dddd", "eeeee"])

    assert embeddings == [[1.0], [2.0], [3.0], [4.0], [5.0]]
    assert mock_client.embeddings.create.await_count == 3


@pytest.mark.asyncio
async def test_rag_service_retrieve_filters_low_relevance():
    from app.core.config import settings
    from app.services.rag_service import rag_service

    with patch.object(rag_service, "_get_chroma") as mock_chroma:
        mock_collection = AsyncMock()
        mock_collection.query = AsyncMock(
            return_value={
                "documents": [["Unrelated chunk"]],
                "metadatas": [[{"source_id": "src", "filename": "test.pdf"}]],
                "distances": [[0.9]],
                "ids": [["src_chunk_0"]],
            }
        )
        mock_client = AsyncMock()
        mock_client.get_collection = AsyncMock(return_value=mock_collection)
        mock_chroma.return_value = mock_client

        with patch.object(settings, "RETRIEVAL_MIN_RELEVANCE", 0.25):
            with patch.object(rag_service, "embed_texts", AsyncMock(return_value=[[0.1] * 10])):
                results = await rag_service.retrieve("workspace_test", "outside topic", top_k=5)

    assert results == []
