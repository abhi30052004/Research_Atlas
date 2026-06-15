from fastapi import APIRouter, Depends, status
from typing import List

from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse
from app.services.workspace_service import workspace_service
from app.core.deps import get_current_user

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workspace(data: WorkspaceCreate, current_user: dict = Depends(get_current_user)):
    return await workspace_service.create(data, str(current_user["_id"]))


@router.get("")
async def list_workspaces(current_user: dict = Depends(get_current_user)):
    workspaces = await workspace_service.list_by_user(str(current_user["_id"]))
    return {"workspaces": workspaces, "total": len(workspaces)}


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, current_user: dict = Depends(get_current_user)):
    return await workspace_service.get_by_id(workspace_id, str(current_user["_id"]))


@router.patch("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    data: WorkspaceUpdate,
    current_user: dict = Depends(get_current_user),
):
    return await workspace_service.update(workspace_id, str(current_user["_id"]), data)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(workspace_id: str, current_user: dict = Depends(get_current_user)):
    await workspace_service.delete(workspace_id, str(current_user["_id"]))
