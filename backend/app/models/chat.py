from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Citation(BaseModel):
    source_id: str
    source_name: str
    chunk_id: str
    page_number: Optional[int] = None
    text_excerpt: str
    relevance_score: float = 0.0


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    role: MessageRole
    content: str
    citations: List[Citation] = Field(default_factory=list)
    followup_suggestions: List[str] = Field(default_factory=list)
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    workspace_id: str
    user_id: str
    title: Optional[str] = None
    messages: List[ChatMessage] = Field(default_factory=list)
    model: str = "gpt-4o"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
