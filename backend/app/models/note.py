from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from bson import ObjectId


class NoteModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    workspace_id: str
    user_id: str
    title: str
    content_json: Optional[Any] = None
    content_html: Optional[str] = None
    content_text: Optional[str] = None
    attached_sources: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    is_pinned: bool = False
    word_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
