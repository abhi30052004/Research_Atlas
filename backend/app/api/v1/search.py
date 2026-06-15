from fastapi import APIRouter, Depends

from app.schemas.search import SearchRequest, SearchResponse
from app.services.search_service import search_service
from app.core.deps import get_current_user

router = APIRouter()


@router.post("", response_model=SearchResponse)
async def global_search(data: SearchRequest, current_user: dict = Depends(get_current_user)):
    return await search_service.search(data, str(current_user["_id"]))
