from fastapi import APIRouter, Depends

from app.schemas.export import ExportRequest
from app.services.export_service import export_service
from app.core.deps import get_current_user

router = APIRouter()


@router.post("")
async def export_content(data: ExportRequest, current_user: dict = Depends(get_current_user)):
    return await export_service.export(
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        format=data.format,
        user_id=str(current_user["_id"]),
        title=data.title,
        include_citations=data.include_citations,
    )
