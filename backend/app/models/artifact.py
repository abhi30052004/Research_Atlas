from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId


class ArtifactType(str, Enum):
    SUMMARY = "summary"
    RESEARCH_REPORT = "research_report"
    BLOG_OUTLINE = "blog_outline"
    FAQ = "faq"
    SOP = "sop"
    COMPARISON_REPORT = "comparison_report"
    DATA_TABLE = "data_table"
    SLIDE_DECK = "slide_deck"
    MIND_MAP = "mind_map"
    FLASHCARDS = "flashcards"
    QUIZ = "quiz"
    INFOGRAPHIC_CONTENT = "infographic_content"
    AUDIO_OVERVIEW_SCRIPT = "audio_overview_script"


class ArtifactModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    workspace_id: str
    user_id: str
    artifact_type: ArtifactType
    title: str
    content: Any
    citations: List[dict] = Field(default_factory=list)
    source_ids: List[str] = Field(default_factory=list)
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    generation_prompt: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
