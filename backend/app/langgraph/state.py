from typing import List, Optional, Any
from typing_extensions import TypedDict


class AgentState(TypedDict):
    query: str
    workspace_id: str
    user_id: str
    model: str
    source_ids: List[str]
    retrieved_docs: List[dict]
    ranked_docs: List[dict]
    response: str
    citations: List[dict]
    followups: List[str]
    error: Optional[str]
    tokens_used: int
