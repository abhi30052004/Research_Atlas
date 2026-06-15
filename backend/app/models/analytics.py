from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum
from bson import ObjectId


class EventType(str, Enum):
    AI_REQUEST = "ai_request"
    SOURCE_UPLOAD = "source_upload"
    CHAT_CREATED = "chat_created"
    ARTIFACT_GENERATED = "artifact_generated"
    EXPORT_GENERATED = "export_generated"
    SEARCH_PERFORMED = "search_performed"
    NOTE_CREATED = "note_created"


class AnalyticsEvent(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    workspace_id: Optional[str] = None
    event_type: EventType
    model_used: Optional[str] = None
    tokens_used: Optional[int] = 0
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
