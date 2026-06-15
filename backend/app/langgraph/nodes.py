import logging
from typing import List
from openai import AsyncOpenAI
from groq import AsyncGroq

from app.core.config import settings
from app.services.rag_service import rag_service
from app.langgraph.state import AgentState

logger = logging.getLogger(__name__)

GROQ_MODELS = set() # {"llama-3.3-70b-versatile", "mixtral-8x7b-32768", "llama3-70b-8192"} disabled per user request


def _get_openai() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _get_groq() -> AsyncGroq:
    return AsyncGroq(api_key=settings.GROQ_API_KEY)


async def analyze_query(state: AgentState) -> AgentState:
    logger.info(f"Analyzing query: {state['query'][:80]}")
    state["retrieved_docs"] = []
    state["ranked_docs"] = []
    state["response"] = ""
    state["citations"] = []
    state["followups"] = []
    state["tokens_used"] = 0
    state["error"] = None
    return state


async def retrieve_documents(state: AgentState) -> AgentState:
    try:
        docs = await rag_service.retrieve(
            workspace_id=state["workspace_id"],
            query=state["query"],
            top_k=settings.RETRIEVAL_TOP_K,
        )
        state["retrieved_docs"] = docs
        logger.info(f"Retrieved {len(docs)} documents")
    except Exception as e:
        logger.warning(f"Retrieval failed: {e}")
        state["retrieved_docs"] = []
    return state


async def rank_context(state: AgentState) -> AgentState:
    docs = state["retrieved_docs"]
    ranked = sorted(docs, key=lambda x: x.get("relevance_score", 0), reverse=True)
    state["ranked_docs"] = ranked[:settings.RETRIEVAL_TOP_K]
    return state


async def generate_answer(state: AgentState) -> AgentState:
    model = state.get("model", settings.OPENAI_DEFAULT_MODEL)
    ranked_docs = state["ranked_docs"]

    context_parts = []
    for i, doc in enumerate(ranked_docs, 1):
        fname = doc.get("filename", "unknown")
        page = f" p.{doc['page_number']}" if doc.get("page_number") else ""
        context_parts.append(f"[Source {i}: {fname}{page}]\n{doc['content']}")
    if not context_parts:
        context = "No relevant sources found in the workspace."
        system_prompt = (
            "You are Atlas, an expert AI research assistant. "
            "The user has not uploaded any sources to this workspace yet, or no relevant content was found. "
            "Politely inform the user that you cannot answer because there are no uploaded sources to reference. "
            "Suggest they upload PDF, DOCX, or web URL sources first, then ask their question again. "
            "Do NOT answer the question using your own knowledge."
        )
    else:
        context = "\n\n---\n\n".join(context_parts)
        system_prompt = (
            "You are Atlas, an expert AI research assistant. "
            "Answer the user's question using ONLY the provided source context below. "
            "Be accurate, concise, and cite sources by their [Source N] number. "
            "You may explain concepts mentioned in the sources for better understanding and clarification, "
            "but do NOT introduce any facts, figures, statistics, or claims that are not present in the provided sources. "
            "If the sources do not contain enough information to answer the question, clearly state: "
            "'The uploaded sources do not contain information about this topic.' "
            "Do not make up or fabricate information."
        )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {state['query']}"},
    ]

    try:
        if model in GROQ_MODELS:
            client = _get_groq()
            response = await client.chat.completions.create(
                model=model, messages=messages, temperature=0.2, max_tokens=2000
            )
        else:
            client = _get_openai()
            response = await client.chat.completions.create(
                model=model, messages=messages, temperature=0.2, max_tokens=2000
            )
        state["response"] = response.choices[0].message.content
        state["tokens_used"] = response.usage.total_tokens if response.usage else 0
    except Exception as e:
        logger.error(f"LLM error: {e}")
        state["response"] = "I encountered an error generating a response. Please try again."
        state["error"] = str(e)
    return state


async def generate_citations(state: AgentState) -> AgentState:
    from app.core.database import get_db
    db = get_db()
    citations = await rag_service.generate_citations(state["ranked_docs"], db)
    state["citations"] = citations
    return state


async def generate_followups(state: AgentState) -> AgentState:
    if not state.get("response"):
        return state
    model = state.get("model", settings.OPENAI_DEFAULT_MODEL)
    prompt = (
        f"Based on this Q&A exchange, generate 3 short follow-up questions the user might ask next.\n"
        f"Q: {state['query']}\nA: {state['response'][:500]}\n\n"
        "Return exactly 3 questions, one per line, no numbering."
    )
    try:
        if model in GROQ_MODELS:
            client = _get_groq()
            resp = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=200,
            )
        else:
            client = _get_openai()
            resp = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=200,
            )
        lines = resp.choices[0].message.content.strip().split("\n")
        state["followups"] = [l.strip() for l in lines if l.strip()][:3]
    except Exception as e:
        logger.warning(f"Followup generation failed: {e}")
        state["followups"] = []
    return state
