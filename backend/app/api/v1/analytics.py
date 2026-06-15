from fastapi import APIRouter, Depends, Query

from app.services.analytics_service import analytics_service
from app.core.deps import get_current_user

router = APIRouter()


@router.get("/dashboard")
async def get_analytics_dashboard(
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    return await analytics_service.get_dashboard(str(current_user["_id"]), days)
