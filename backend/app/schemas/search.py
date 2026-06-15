from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    workspace_id: Optional[str] = None
    include_sources: bool = True
    include_chats: bool = True
    include_notes: bool = True
    include_artifacts: bool = True
    limit: int = Field(default=20, ge=1, le=100)


class SearchResult(BaseModel):
    id: str
    type: str
    title: str
    excerpt: str
    workspace_id: Optional[str] = None
    score: float = 0.0
    created_at: Optional[datetime] = None
    metadata: dict = {}


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int
    took_ms: float
