from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class AsyncCursor:
    def __init__(self, items):
        self._items = iter(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration


def make_state():
    return {
        "query": "summarize this source",
        "workspace_id": "workspace_1",
        "user_id": "user_1",
        "model": "gpt-4o",
        "source_ids": [],
        "retrieved_docs": [],
        "ranked_docs": [],
        "response": "",
        "citations": [],
        "followups": [],
        "error": None,
        "tokens_used": 0,
    }


@pytest.mark.asyncio
async def test_retrieve_documents_uses_completed_sources_with_chunks():
    from app.core.config import settings
    from app.langgraph.nodes import retrieve_documents

    db = MagicMock()
    db.sources.find.return_value = AsyncCursor([{"_id": "source_1"}, {"_id": "source_2"}])
    retrieved_docs = [
        {
            "content": "Relevant source content",
            "source_id": "source_1",
            "chunk_id": "source_1_chunk_0",
            "relevance_score": 0.8,
        }
    ]

    with (
        patch("app.langgraph.nodes.get_db", return_value=db),
        patch("app.langgraph.nodes.rag_service.retrieve", new=AsyncMock(return_value=retrieved_docs)) as mock_retrieve,
        patch.object(settings, "CHAT_RETRIEVAL_TOP_K", 18),
    ):
        state = await retrieve_documents(make_state())

    db.sources.find.assert_called_once_with(
        {
            "workspace_id": "workspace_1",
            "user_id": "user_1",
            "status": "completed",
            "chunk_count": {"$gt": 0},
        },
        {"_id": 1},
    )
    mock_retrieve.assert_awaited_once_with(
        workspace_id="workspace_1",
        query="summarize this source",
        top_k=18,
        source_ids=["source_1", "source_2"],
    )
    assert state["source_ids"] == ["source_1", "source_2"]
    assert state["retrieved_docs"] == retrieved_docs


@pytest.mark.asyncio
async def test_retrieve_documents_skips_rag_when_no_ready_sources():
    from app.langgraph.nodes import retrieve_documents

    db = MagicMock()
    db.sources.find.return_value = AsyncCursor([])

    with (
        patch("app.langgraph.nodes.get_db", return_value=db),
        patch("app.langgraph.nodes.rag_service.retrieve", new=AsyncMock()) as mock_retrieve,
    ):
        state = await retrieve_documents(make_state())

    mock_retrieve.assert_not_awaited()
    assert state["source_ids"] == []
    assert state["retrieved_docs"] == []
