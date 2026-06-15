from fastapi import APIRouter, Depends, Query, status

from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse, NoteListResponse
from app.services.note_service import note_service
from app.core.deps import get_current_user

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_note(data: NoteCreate, current_user: dict = Depends(get_current_user)):
    return await note_service.create(data, str(current_user["_id"]))


@router.get("")
async def list_notes(
    workspace_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    notes = await note_service.list_by_workspace(workspace_id, str(current_user["_id"]))
    return {"notes": notes, "total": len(notes)}


@router.get("/{note_id}")
async def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    return await note_service.get_by_id(note_id, str(current_user["_id"]))


@router.patch("/{note_id}")
async def update_note(
    note_id: str,
    data: NoteUpdate,
    current_user: dict = Depends(get_current_user),
):
    return await note_service.update(note_id, str(current_user["_id"]), data)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    await note_service.delete(note_id, str(current_user["_id"]))
