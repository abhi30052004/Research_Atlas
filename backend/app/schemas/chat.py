from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.chat import ChatMessage, MessageRole


class ChatCreate(BaseModel):
    workspace_id: str
    model: str = "gpt-4o"
    title: Optional[str] = None


class ChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    model: Optional[str] = None
    source_ids: Optional[List[str]] = None


class RegenerateRequest(BaseModel):
    message_id: str
    model: Optional[str] = None
    source_ids: Optional[List[str]] = None


class ChatResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: Optional[str] = None
    messages: List[ChatMessage]
    model: str
    created_at: datetime
    updated_at: datetime


class ChatListResponse(BaseModel):
    chats: List[dict]
    total: int


class StreamChunk(BaseModel):
    type: str
    content: str
    citations: Optional[List[dict]] = None
    followups: Optional[List[str]] = None
    done: bool = False
