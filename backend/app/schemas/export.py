from pydantic import BaseModel
from typing import Optional
from enum import Enum


class ExportFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    CSV = "csv"
    MARKDOWN = "markdown"


class ExportRequest(BaseModel):
    entity_type: str
    entity_id: str
    format: ExportFormat
    title: Optional[str] = None
    include_citations: bool = True
