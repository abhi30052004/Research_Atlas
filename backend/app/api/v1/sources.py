from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, status, Query
from typing import List, Optional

from app.schemas.source import SourceURLCreate, SourceResponse, SourceListResponse
from app.services.source_service import source_service
from app.core.deps import get_current_user

router = APIRouter()


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_source(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    workspace_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    return await source_service.upload_file(
        file,
        workspace_id,
        str(current_user["_id"]),
        background_tasks,
    )


@router.post("/upload/batch", status_code=status.HTTP_202_ACCEPTED)
async def upload_sources_batch(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    workspace_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload multiple files at once. All are saved and queued for processing concurrently."""
    results = await source_service.upload_files_batch(
        files,
        workspace_id,
        str(current_user["_id"]),
        background_tasks,
    )
    return {"sources": results}


@router.post("/url", status_code=status.HTTP_202_ACCEPTED)
async def add_url_source(
    data: SourceURLCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    return await source_service.add_url(
        data.url,
        data.workspace_id,
        str(current_user["_id"]),
        data.name,
        background_tasks,
    )


@router.get("")
async def list_sources(
    workspace_id: str = Query(...),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    return await source_service.list_by_workspace(workspace_id, str(current_user["_id"]), page, page_size)


@router.get("/{source_id}")
async def get_source(source_id: str, current_user: dict = Depends(get_current_user)):
    return await source_service.get_by_id(source_id, str(current_user["_id"]))


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(source_id: str, current_user: dict = Depends(get_current_user)):
    await source_service.delete(source_id, str(current_user["_id"]))
