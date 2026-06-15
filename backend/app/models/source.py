from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from bson import ObjectId


class SourceType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    CSV = "csv"
    XLSX = "xlsx"
    PPTX = "pptx"
    URL = "url"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SourceModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    workspace_id: str
    user_id: str
    filename: str
    original_name: str
    source_type: SourceType
    file_path: Optional[str] = None
    url: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    status: ProcessingStatus = ProcessingStatus.PENDING
    chunk_count: int = 0
    page_count: Optional[int] = None
    word_count: Optional[int] = None
    error_message: Optional[str] = None
    chroma_collection: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
