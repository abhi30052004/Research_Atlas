from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)


class WorkspaceResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    source_count: int
    chat_count: int
    note_count: int
    artifact_count: int
    created_at: datetime
    updated_at: datetime
