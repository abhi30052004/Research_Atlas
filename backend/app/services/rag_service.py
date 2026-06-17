import logging
import asyncio
import re
from typing import List, Dict, Any, Optional
import chromadb
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.database import get_db

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

    def _slug(self, value: str) -> str:
        return re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_")

    def collection_name(
        self,
        workspace_id: str,
        model: Optional[str] = None,
        dimensions: Optional[int] = None,
    ) -> str:
        model = model or settings.OPENAI_EMBEDDING_MODEL
        if dimensions is None and model == settings.OPENAI_EMBEDDING_MODEL:
            dimensions = settings.OPENAI_EMBEDDING_DIMENSIONS
        dim_label = str(dimensions) if dimensions else "full"
        return f"workspace_{workspace_id}_{self._slug(model)}_{dim_label}"

    def legacy_collection_names(self, workspace_id: str) -> List[str]:
        names = [f"workspace_{workspace_id}"]
        legacy_model_name = self.collection_name(
            workspace_id,
            settings.LEGACY_EMBEDDING_MODEL,
            settings.LEGACY_EMBEDDING_DIMENSIONS,
        )
        if legacy_model_name not in names:
            names.append(legacy_model_name)
        return names

    def _batched(self, items: List[Any], batch_size: int):
        batch_size = max(1, batch_size)
        for index in range(0, len(items), batch_size):
            yield items[index: index + batch_size]

    async def store_source_chunks(
        self,
        workspace_id: str,
        source_id: str,
        chunks: List[Dict[str, Any]],
    ) -> int:
        db = get_db()
        await db.source_chunks.delete_many({"source_id": source_id})
        if not chunks:
            return 0

        batch = []
        total = 0
        insert_batch_size = max(1, settings.SOURCE_CHUNK_INSERT_BATCH_SIZE)
        for chunk in chunks:
            metadata = chunk.get("metadata", {})
            batch.append({
                "_id": chunk["chunk_id"],
                "workspace_id": workspace_id,
                "source_id": source_id,
                "chunk_id": chunk["chunk_id"],
                "content": chunk["content"],
                "filename": metadata.get("filename"),
                "page_number": metadata.get("page_number"),
                "chunk_index": metadata.get("chunk_index", 0),
                "metadata": metadata,
            })
            if len(batch) >= insert_batch_size:
                await db.source_chunks.insert_many(batch, ordered=False)
                total += len(batch)
                batch = []

        if batch:
            await db.source_chunks.insert_many(batch, ordered=False)
            total += len(batch)
        return total

    def _embedding_dimensions_for_model(
        self,
        model: str,
        dimensions: Optional[int],
    ) -> Optional[int]:
        if dimensions and model.startswith("text-embedding-3"):
            return dimensions
        return None

    async def embed_texts(
        self,
        texts: List[str],
        model: Optional[str] = None,
        dimensions: Optional[int] = None,
    ) -> List[List[float]]:
        if not texts:
            return []
        model = model or settings.OPENAI_EMBEDDING_MODEL
        if dimensions is None and model == settings.OPENAI_EMBEDDING_MODEL:
            dimensions = settings.OPENAI_EMBEDDING_DIMENSIONS
        embedding_dimensions = self._embedding_dimensions_for_model(model, dimensions)
        client = self._get_openai()
        batches = list(enumerate(self._batched(texts, settings.EMBEDDING_BATCH_SIZE)))
        concurrency = max(1, settings.EMBEDDING_CONCURRENCY)
        semaphore = asyncio.Semaphore(concurrency)

        async def embed_batch(batch_index: int, batch: List[str]):
            payload = {"model": model, "input": batch}
            if embedding_dimensions:
                payload["dimensions"] = embedding_dimensions
            async with semaphore:
                response = await client.embeddings.create(**payload)
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

    async def embed_chunk_texts(self, chunks: List[Dict[str, Any]]) -> List[List[float]]:
        texts = [chunk["content"] for chunk in chunks]
        if not texts:
            return []

        unique_texts = []
        text_indexes = []
        unique_index_by_text = {}
        for text in texts:
            unique_index = unique_index_by_text.get(text)
            if unique_index is None:
                unique_index = len(unique_texts)
                unique_index_by_text[text] = unique_index
                unique_texts.append(text)
            text_indexes.append(unique_index)

        unique_embeddings = await self.embed_texts(unique_texts)
        if len(unique_embeddings) != len(unique_texts):
            raise RuntimeError(
                f"Embedding provider returned {len(unique_embeddings)} embeddings for {len(unique_texts)} inputs"
            )
        return [unique_embeddings[index] for index in text_indexes]

    async def _get_index_collection(self, workspace_id: str):
        chroma = await self._get_chroma()
        return await chroma.get_or_create_collection(
            name=self.collection_name(workspace_id),
            metadata={
                "hnsw:space": "cosine",
                "embedding_model": settings.OPENAI_EMBEDDING_MODEL,
                "embedding_dimensions": settings.OPENAI_EMBEDDING_DIMENSIONS or "full",
            },
        )

    async def _index_chunk_batch(self, collection, batch: List[Dict[str, Any]]) -> int:
        embeddings = await self.embed_chunk_texts(batch)
        texts = [c["content"] for c in batch]
        ids = [c["chunk_id"] for c in batch]
        metadatas = [
            {
                **c["metadata"],
                "chunk_id": c["chunk_id"],
                "embedding_model": settings.OPENAI_EMBEDDING_MODEL,
                "embedding_dimensions": settings.OPENAI_EMBEDDING_DIMENSIONS or "full",
            }
            for c in batch
        ]
        await collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )
        return len(batch)

    async def index_chunk_batches(self, workspace_id: str, chunk_batches) -> int:
        collection = await self._get_index_collection(workspace_id)
        concurrency = max(1, settings.SOURCE_INDEX_BATCH_CONCURRENCY)
        semaphore = asyncio.Semaphore(concurrency)
        pending = set()
        total = 0

        async def index_with_limit(batch: List[Dict[str, Any]]) -> int:
            async with semaphore:
                return await self._index_chunk_batch(collection, batch)

        try:
            async for batch in chunk_batches:
                if not batch:
                    continue
                pending.add(asyncio.create_task(index_with_limit(batch)))
                if len(pending) >= concurrency:
                    done, pending = await asyncio.wait(
                        pending,
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    for task in done:
                        total += task.result()

            if pending:
                total += sum(await asyncio.gather(*pending))
        except Exception:
            for task in pending:
                task.cancel()
            raise

        logger.info(f"Indexed {total} chunks in workspace {workspace_id}")
        return total

    async def index_chunks(self, workspace_id: str, chunks: List[Dict[str, Any]]) -> int:
        if not chunks:
            return 0

        async def chunk_batches():
            for batch in self._batched(chunks, settings.CHROMA_ADD_BATCH_SIZE):
                yield batch

        return await self.index_chunk_batches(workspace_id, chunk_batches())

    async def _retrieve_from_collection(
        self,
        collection_name: str,
        query: str,
        top_k: int,
        source_ids: Optional[List[str]],
        model: str,
        dimensions: Optional[int],
    ) -> List[Dict[str, Any]]:
        try:
            chroma = await self._get_chroma()
            collection = await chroma.get_collection(collection_name)
            query_embedding = await self.embed_texts([query], model=model, dimensions=dimensions)
            where = {"source_id": {"$in": source_ids}} if source_ids else None
            results = await collection.query(
                query_embeddings=query_embedding,
                n_results=top_k,
                where=where,
                include=["documents", "metadatas", "distances"],
            )
            docs = []
            ids = results.get("ids", [[]])[0]
            for i, doc in enumerate(results.get("documents", [[]])[0]):
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
            return docs
        except Exception as e:
            logger.debug(f"Retrieval skipped for collection {collection_name}: {e}")
            return []

    def _query_terms(self, query: str) -> List[str]:
        terms = re.findall(r"[a-zA-Z0-9]{3,}", query.lower())
        stopwords = {
            "the", "and", "for", "with", "that", "this", "from", "what", "when",
            "where", "which", "about", "into", "your", "please", "summarize",
        }
        return [term for term in terms if term not in stopwords][:12]

    async def _retrieve_from_mongo_chunks(
        self,
        workspace_id: str,
        query: str,
        top_k: int,
        source_ids: Optional[List[str]],
    ) -> List[Dict[str, Any]]:
        try:
            db = get_db()
            mongo_query = {"workspace_id": workspace_id}
            if source_ids:
                mongo_query["source_id"] = {"$in": source_ids}

            cursor = (
                db.source_chunks.find(mongo_query)
                .sort("chunk_index", 1)
                .limit(settings.KEYWORD_FALLBACK_CHUNK_LIMIT)
            )
            terms = self._query_terms(query)
            docs = []
            async for chunk in cursor:
                content = chunk.get("content", "")
                lowered = content.lower()
                score = sum(lowered.count(term) for term in terms)
                if terms and score == 0:
                    continue
                metadata = chunk.get("metadata", {})
                docs.append({
                    "content": content,
                    "metadata": metadata,
                    "relevance_score": min(0.95, 0.45 + (score * 0.05)) if terms else 0.45,
                    "source_id": chunk.get("source_id"),
                    "filename": chunk.get("filename") or metadata.get("filename"),
                    "page_number": chunk.get("page_number") or metadata.get("page_number"),
                    "chunk_id": chunk.get("chunk_id") or str(chunk.get("_id")),
                })

            if not docs:
                fallback_cursor = (
                    db.source_chunks.find(mongo_query)
                    .sort("chunk_index", 1)
                    .limit(top_k)
                )
                async for chunk in fallback_cursor:
                    metadata = chunk.get("metadata", {})
                    docs.append({
                        "content": chunk.get("content", ""),
                        "metadata": metadata,
                        "relevance_score": 0.4,
                        "source_id": chunk.get("source_id"),
                        "filename": chunk.get("filename") or metadata.get("filename"),
                        "page_number": chunk.get("page_number") or metadata.get("page_number"),
                        "chunk_id": chunk.get("chunk_id") or str(chunk.get("_id")),
                    })

            return sorted(docs, key=lambda x: x["relevance_score"], reverse=True)[:top_k]
        except Exception as e:
            logger.debug(f"Mongo chunk fallback retrieval failed for workspace {workspace_id}: {e}")
            return []

    async def _apply_source_display_names(self, docs: List[Dict[str, Any]]) -> None:
        source_ids = list({doc.get("source_id") for doc in docs if doc.get("source_id")})
        if not source_ids:
            return

        try:
            db = get_db()
            names = {}
            cursor = db.sources.find(
                {"_id": {"$in": source_ids}},
                {"original_name": 1, "filename": 1},
            )
            async for source in cursor:
                display_name = source.get("original_name") or source.get("filename")
                if display_name:
                    names[str(source["_id"])] = display_name

            for doc in docs:
                display_name = names.get(str(doc.get("source_id")))
                if not display_name:
                    continue
                metadata = doc.setdefault("metadata", {})
                stored_filename = doc.get("filename") or metadata.get("filename")
                if stored_filename and stored_filename != display_name:
                    metadata.setdefault("stored_filename", stored_filename)
                    doc.setdefault("stored_filename", stored_filename)
                doc["filename"] = display_name
                doc["source_name"] = display_name
                metadata["filename"] = display_name
                metadata["source_name"] = display_name
        except Exception as e:
            logger.debug(f"Source display-name enrichment failed: {e}")

    async def retrieve(
        self,
        workspace_id: str,
        query: str,
        top_k: int = None,
        source_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        top_k = top_k or settings.RETRIEVAL_TOP_K
        try:
            docs = await self._retrieve_from_collection(
                self.collection_name(workspace_id),
                query,
                top_k,
                source_ids,
                settings.OPENAI_EMBEDDING_MODEL,
                settings.OPENAI_EMBEDDING_DIMENSIONS,
            )
            if settings.SEARCH_LEGACY_COLLECTIONS:
                for collection_name in self.legacy_collection_names(workspace_id):
                    docs.extend(await self._retrieve_from_collection(
                        collection_name,
                        query,
                        top_k,
                        source_ids,
                        settings.LEGACY_EMBEDDING_MODEL,
                        settings.LEGACY_EMBEDDING_DIMENSIONS,
                    ))
            if len(docs) < top_k:
                docs.extend(await self._retrieve_from_mongo_chunks(
                    workspace_id,
                    query,
                    top_k,
                    source_ids,
                ))

            deduped = {}
            for doc in docs:
                key = doc.get("chunk_id") or f"{doc.get('source_id')}:{doc.get('content')[:80]}"
                if key not in deduped or doc["relevance_score"] > deduped[key]["relevance_score"]:
                    deduped[key] = doc
            results = sorted(deduped.values(), key=lambda x: x["relevance_score"], reverse=True)[:top_k]
            await self._apply_source_display_names(results)
            return results
        except Exception as e:
            logger.warning(f"Retrieval error for workspace {workspace_id}: {e}")
            return []

    async def delete_source_chunks(self, workspace_id: str, source_id: str) -> None:
        db = get_db()
        await db.source_chunks.delete_many({"source_id": source_id})
        chroma = await self._get_chroma()
        collection_names = [self.collection_name(workspace_id), *self.legacy_collection_names(workspace_id)]
        for collection_name in dict.fromkeys(collection_names):
            try:
                collection = await chroma.get_collection(collection_name)
                await collection.delete(where={"source_id": source_id})
            except Exception as e:
                logger.debug(f"Failed to delete chunks for source {source_id} in {collection_name}: {e}")

    async def delete_workspace_collection(self, workspace_id: str) -> None:
        chroma = await self._get_chroma()
        collection_names = [self.collection_name(workspace_id), *self.legacy_collection_names(workspace_id)]
        for collection_name in dict.fromkeys(collection_names):
            try:
                await chroma.delete_collection(collection_name)
            except Exception as e:
                logger.debug(f"Failed to delete collection {collection_name}: {e}")

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
