from pydantic import BaseModel, HttpUrl, Field
from typing import Optional
from datetime import datetime
from app.models.source import SourceType, ProcessingStatus


class SourceURLCreate(BaseModel):
    url: str
    workspace_id: str
    name: Optional[str] = None


class SourceResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    filename: str
    original_name: str
    source_type: SourceType
    file_size: Optional[int] = None
    status: ProcessingStatus
    chunk_count: int
    page_count: Optional[int] = None
    word_count: Optional[int] = None
    error_message: Optional[str] = None
    metadata: dict
    created_at: datetime
    updated_at: datetime


class SourceListResponse(BaseModel):
    sources: list[SourceResponse]
    total: int
    page: int
    page_size: int
