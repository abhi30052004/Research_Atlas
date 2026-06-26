from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from app.models.artifact import ArtifactType


class ArtifactGenerateRequest(BaseModel):
    workspace_id: str
    artifact_type: ArtifactType
    title: Optional[str] = None
    source_ids: Optional[List[str]] = None
    custom_prompt: Optional[str] = None
    model: str = "gpt-4o"


class VisualAssetRequest(BaseModel):
    mode: str = Field(default="search", pattern="^(search|generate)$")
    query: Optional[str] = None
    prompt: Optional[str] = None


class VisualBlockEditRequest(BaseModel):
    artifact_type: ArtifactType
    block: Any
    instruction: str
    model: str = "gpt-4o"


class ArtifactResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    artifact_type: ArtifactType
    title: str
    content: Any
    citations: List[dict]
    source_ids: List[str]
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class ArtifactListResponse(BaseModel):
    artifacts: List[ArtifactResponse]
    total: int
