from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class NoteCreate(BaseModel):
    workspace_id: str
    title: str = Field(min_length=1, max_length=200)
    content_json: Optional[Any] = None
    content_html: Optional[str] = None
    content_text: Optional[str] = None
    attached_sources: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content_json: Optional[Any] = None
    content_html: Optional[str] = None
    content_text: Optional[str] = None
    attached_sources: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    is_pinned: Optional[bool] = None


class NoteResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: str
    content_json: Optional[Any] = None
    content_html: Optional[str] = None
    content_text: Optional[str] = None
    attached_sources: List[str]
    tags: List[str]
    is_pinned: bool
    word_count: int
    created_at: datetime
    updated_at: datetime


class NoteListResponse(BaseModel):
    notes: List[NoteResponse]
    total: int
