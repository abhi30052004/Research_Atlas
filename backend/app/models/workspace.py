from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId


class WorkspaceModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    name: str
    description: Optional[str] = None
    source_count: int = 0
    chat_count: int = 0
    note_count: int = 0
    artifact_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
