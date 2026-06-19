from langgraph.graph import StateGraph, END
from typing import Optional, List

from app.langgraph.state import AgentState
from app.langgraph.nodes import (
    analyze_query,
    retrieve_documents,
    rank_context,
    generate_answer,
    generate_citations,
    generate_followups,
)


def build_agent() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("query_analysis", analyze_query)
    graph.add_node("document_retrieval", retrieve_documents)
    graph.add_node("context_ranking", rank_context)
    graph.add_node("answer_generation", generate_answer)
    graph.add_node("citation_generator", generate_citations)
    graph.add_node("followup_generator", generate_followups)

    graph.set_entry_point("query_analysis")
    graph.add_edge("query_analysis", "document_retrieval")
    graph.add_edge("document_retrieval", "context_ranking")
    graph.add_edge("context_ranking", "answer_generation")
    graph.add_edge("answer_generation", "citation_generator")
    graph.add_edge("citation_generator", "followup_generator")
    graph.add_edge("followup_generator", END)

    return graph.compile()


atlas_agent = build_agent()


async def run_agent(
    query: str,
    workspace_id: str,
    user_id: str,
    model: str = "gpt-4o",
    source_ids: Optional[List[str]] = None,
) -> AgentState:
    initial_state: AgentState = {
        "query": query,
        "workspace_id": workspace_id,
        "user_id": user_id,
        "model": model,
        "source_ids": source_ids or [],
        "retrieval_top_k": 0,
        "retrieved_docs": [],
        "ranked_docs": [],
        "response": "",
        "citations": [],
        "followups": [],
        "error": None,
        "tokens_used": 0,
    }
    result = await atlas_agent.ainvoke(initial_state)
    return result
