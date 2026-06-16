import logging
import asyncio
from typing import List, Dict, Any, Optional
import chromadb
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class RAGService:
    def __init__(self):
        self._client: Optional[chromadb.AsyncHttpClient] = None
        self._openai: Optional[AsyncOpenAI] = None

    async def _get_chroma(self) -> chromadb.AsyncHttpClient:
        if not self._client:
            self._client = await chromadb.AsyncHttpClient(
                host=settings.CHROMA_HOST,
                port=settings.CHROMA_PORT,
            )
        return self._client

    def _get_openai(self) -> AsyncOpenAI:
        if not self._openai:
            self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai

    def collection_name(self, workspace_id: str) -> str:
        return f"workspace_{workspace_id}"

    def _batched(self, items: List[Any], batch_size: int):
        batch_size = max(1, batch_size)
        for index in range(0, len(items), batch_size):
            yield items[index: index + batch_size]

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        client = self._get_openai()
        batches = list(enumerate(self._batched(texts, settings.EMBEDDING_BATCH_SIZE)))
        concurrency = max(1, settings.EMBEDDING_CONCURRENCY)
        semaphore = asyncio.Semaphore(concurrency)

        async def embed_batch(batch_index: int, batch: List[str]):
            async with semaphore:
                response = await client.embeddings.create(
                    model=settings.OPENAI_EMBEDDING_MODEL,
                    input=batch,
                )
            data = list(response.data)
            if all(isinstance(getattr(item, "index", None), int) for item in data):
                data.sort(key=lambda item: item.index)
            return batch_index, [item.embedding for item in data]

        batch_results = await asyncio.gather(
            *(embed_batch(index, batch) for index, batch in batches)
        )

        embeddings = []
        for _, batch_embeddings in sorted(batch_results, key=lambda item: item[0]):
            embeddings.extend(batch_embeddings)
        return embeddings

    async def index_chunks(self, workspace_id: str, chunks: List[Dict[str, Any]]) -> int:
        if not chunks:
            return 0
        chroma = await self._get_chroma()
        collection = await chroma.get_or_create_collection(
            name=self.collection_name(workspace_id),
            metadata={"hnsw:space": "cosine"},
        )
        for batch in self._batched(chunks, settings.CHROMA_ADD_BATCH_SIZE):
            texts = [c["content"] for c in batch]
            embeddings = await self.embed_texts(texts)
            ids = [c["chunk_id"] for c in batch]
            metadatas = [c["metadata"] for c in batch]
            await collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
            )
        logger.info(f"Indexed {len(chunks)} chunks in workspace {workspace_id}")
        return len(chunks)

    async def retrieve(
        self,
        workspace_id: str,
        query: str,
        top_k: int = None,
        source_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        top_k = top_k or settings.RETRIEVAL_TOP_K
        try:
            chroma = await self._get_chroma()
            collection = await chroma.get_collection(self.collection_name(workspace_id))
            query_embedding = await self.embed_texts([query])
            where = {"source_id": {"$in": source_ids}} if source_ids else None
            results = await collection.query(
                query_embeddings=query_embedding,
                n_results=top_k,
                where=where,
                include=["documents", "metadatas", "distances"],
            )
            docs = []
            ids = results.get("ids", [[]])[0]
            for i, doc in enumerate(results["documents"][0]):
                metadata = results["metadatas"][0][i]
                distance = results["distances"][0][i]
                relevance_score = 1 - distance
                if relevance_score < settings.RETRIEVAL_MIN_RELEVANCE:
                    continue
                docs.append({
                    "content": doc,
                    "metadata": metadata,
                    "relevance_score": relevance_score,
                    "source_id": metadata.get("source_id"),
                    "filename": metadata.get("filename"),
                    "page_number": metadata.get("page_number"),
                    "chunk_id": metadata.get("chunk_id", ids[i] if i < len(ids) else ""),
                })
            return sorted(docs, key=lambda x: x["relevance_score"], reverse=True)
        except Exception as e:
            logger.warning(f"Retrieval error for workspace {workspace_id}: {e}")
            return []

    async def delete_source_chunks(self, workspace_id: str, source_id: str) -> None:
        try:
            chroma = await self._get_chroma()
            collection = await chroma.get_collection(self.collection_name(workspace_id))
            await collection.delete(where={"source_id": source_id})
        except Exception as e:
            logger.warning(f"Failed to delete chunks for source {source_id}: {e}")

    async def delete_workspace_collection(self, workspace_id: str) -> None:
        try:
            chroma = await self._get_chroma()
            await chroma.delete_collection(self.collection_name(workspace_id))
        except Exception as e:
            logger.warning(f"Failed to delete collection for workspace {workspace_id}: {e}")

    async def generate_citations(self, retrieved_docs: List[Dict[str, Any]], db) -> List[dict]:
        citations = []
        seen = set()
        for doc in retrieved_docs:
            source_id = doc.get("source_id")
            if not source_id or source_id in seen:
                continue
            seen.add(source_id)
            source = await db.sources.find_one({"_id": source_id})
            citations.append({
                "source_id": source_id,
                "source_name": source.get("original_name", "Unknown") if source else "Unknown",
                "chunk_id": doc.get("chunk_id", ""),
                "page_number": doc.get("page_number"),
                "text_excerpt": doc.get("content", "")[:300],
                "relevance_score": doc.get("relevance_score", 0.0),
            })
        return citations


rag_service = RAGService()
