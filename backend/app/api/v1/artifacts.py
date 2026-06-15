from fastapi import APIRouter, Depends, Query, status

from app.schemas.artifact import ArtifactGenerateRequest, ArtifactResponse, ArtifactListResponse
from app.services.artifact_service import artifact_service
from app.core.deps import get_current_user

router = APIRouter()


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_artifact(
    data: ArtifactGenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await artifact_service.generate(
        workspace_id=data.workspace_id,
        user_id=str(current_user["_id"]),
        artifact_type=data.artifact_type,
        title=data.title,
        source_ids=data.source_ids,
        custom_prompt=data.custom_prompt,
        model=data.model,
    )


@router.get("")
async def list_artifacts(
    workspace_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    artifacts = await artifact_service.list_by_workspace(workspace_id, str(current_user["_id"]))
    return {"artifacts": artifacts, "total": len(artifacts)}


@router.get("/{artifact_id}")
async def get_artifact(artifact_id: str, current_user: dict = Depends(get_current_user)):
    return await artifact_service.get_by_id(artifact_id, str(current_user["_id"]))


@router.delete("/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(artifact_id: str, current_user: dict = Depends(get_current_user)):
    await artifact_service.delete(artifact_id, str(current_user["_id"]))
