import time
from typing import Optional
from app.core.database import get_db
from app.schemas.search import SearchRequest, SearchResponse, SearchResult


class SearchService:
    async def search(self, request: SearchRequest, user_id: str) -> SearchResponse:
        db = get_db()
        start = time.perf_counter()
        results = []

        base_filter = {"user_id": user_id}
        if request.workspace_id:
            base_filter["workspace_id"] = request.workspace_id

        text_query = {"$text": {"$search": request.query}}

        if request.include_sources:
            cursor = db.sources.find({**base_filter, **text_query}, {"score": {"$meta": "textScore"}}).sort(
                [("score", {"$meta": "textScore"})]
            ).limit(request.limit // 4 + 1)
            async for doc in cursor:
                results.append(SearchResult(
                    id=str(doc["_id"]),
                    type="source",
                    title=doc.get("original_name", ""),
                    excerpt=f"Type: {doc.get('source_type', '')} | Status: {doc.get('status', '')}",
                    workspace_id=doc.get("workspace_id"),
                    score=doc.get("score", 0.0),
                    created_at=doc.get("created_at"),
                    metadata={"source_type": doc.get("source_type", ""), "status": doc.get("status", "")},
                ))

        if request.include_notes:
            cursor = db.notes.find({**base_filter, **text_query}, {"score": {"$meta": "textScore"}}).sort(
                [("score", {"$meta": "textScore"})]
            ).limit(request.limit // 4 + 1)
            async for doc in cursor:
                content_excerpt = (doc.get("content_text") or doc.get("content_html") or "")[:200]
                results.append(SearchResult(
                    id=str(doc["_id"]),
                    type="note",
                    title=doc.get("title", ""),
                    excerpt=content_excerpt,
                    workspace_id=doc.get("workspace_id"),
                    score=doc.get("score", 0.0),
                    created_at=doc.get("created_at"),
                ))

        if request.include_chats:
            cursor = db.chats.find({**base_filter, **text_query}, {"score": {"$meta": "textScore"}}).sort(
                [("score", {"$meta": "textScore"})]
            ).limit(request.limit // 4 + 1)
            async for doc in cursor:
                results.append(SearchResult(
                    id=str(doc["_id"]),
                    type="chat",
                    title=doc.get("title") or f"Chat {str(doc['_id'])[:8]}",
                    excerpt=f"{len(doc.get('messages', []))} messages",
                    workspace_id=doc.get("workspace_id"),
                    score=doc.get("score", 0.0),
                    created_at=doc.get("created_at"),
                ))

        if request.include_artifacts:
            cursor = db.artifacts.find({**base_filter, **text_query}, {"score": {"$meta": "textScore"}}).sort(
                [("score", {"$meta": "textScore"})]
            ).limit(request.limit // 4 + 1)
            async for doc in cursor:
                results.append(SearchResult(
                    id=str(doc["_id"]),
                    type="artifact",
                    title=doc.get("title", ""),
                    excerpt=f"Type: {doc.get('artifact_type', '')}",
                    workspace_id=doc.get("workspace_id"),
                    score=doc.get("score", 0.0),
                    created_at=doc.get("created_at"),
                    metadata={"artifact_type": doc.get("artifact_type", "")},
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        results = results[: request.limit]

        took_ms = (time.perf_counter() - start) * 1000
        return SearchResponse(
            query=request.query,
            results=results,
            total=len(results),
            took_ms=round(took_ms, 2),
        )


search_service = SearchService()
