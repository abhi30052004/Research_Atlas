from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Optional
import re

from app.schemas.settings import UpdateProfileRequest, UpdateSettingsRequest, UserSettingsResponse
from app.core.deps import get_current_user
from app.core.database import get_db
from app.core.security import verify_password, hash_password

router = APIRouter()


# ─── Additional request schemas ───

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UpdateUsernameRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)


class UpdateFullProfileRequest(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None


# ─── Profile endpoints ───

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the current user's profile."""
    return {
        "id": str(current_user["_id"]),
        "email": current_user["email"],
        "username": current_user["username"],
        "full_name": current_user.get("full_name"),
        "avatar_url": current_user.get("avatar_url"),
        "is_verified": current_user.get("is_verified", False),
        "created_at": str(current_user.get("created_at", "")),
    }


@router.patch("/profile")
async def update_profile(data: UpdateFullProfileRequest, current_user: dict = Depends(get_current_user)):
    """Update the current user's profile (name, username, avatar)."""
    db = get_db()
    update_fields: dict = {"updated_at": datetime.now(timezone.utc)}

    if data.full_name is not None:
        update_fields["full_name"] = data.full_name
    if data.avatar_url is not None:
        update_fields["avatar_url"] = data.avatar_url
    if data.username is not None:
        # Validate username format
        if not re.match(r"^[a-zA-Z0-9_]+$", data.username):
            raise HTTPException(status_code=400, detail="Username must be alphanumeric with underscores only")
        if len(data.username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
        # Check uniqueness
        existing = await db.users.find_one({"username": data.username, "_id": {"$ne": str(current_user["_id"])}})
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        update_fields["username"] = data.username

    if len(update_fields) > 1:
        await db.users.update_one(
            {"_id": str(current_user["_id"])},
            {"$set": update_fields},
        )

    updated = await db.users.find_one({"_id": str(current_user["_id"])})
    return {
        "id": str(updated["_id"]),
        "email": updated["email"],
        "username": updated["username"],
        "full_name": updated.get("full_name"),
        "avatar_url": updated.get("avatar_url"),
        "message": "Profile updated successfully",
    }


@router.post("/change-password")
async def change_password(data: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Change the current user's password. Requires the correct current password."""
    db = get_db()

    # Verify current password
    if not verify_password(data.current_password, current_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Validate new password strength
    if not any(c.isupper() for c in data.new_password):
        raise HTTPException(status_code=400, detail="New password must contain at least one uppercase letter")
    if not any(c.islower() for c in data.new_password):
        raise HTTPException(status_code=400, detail="New password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in data.new_password):
        raise HTTPException(status_code=400, detail="New password must contain at least one digit")

    # Update password
    await db.users.update_one(
        {"_id": str(current_user["_id"])},
        {"$set": {
            "hashed_password": hash_password(data.new_password),
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    return {"message": "Password changed successfully"}


# ─── Settings endpoints ───

@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    """Get the current user's settings."""
    db = get_db()
    settings_doc = await db.user_settings.find_one({"user_id": str(current_user["_id"])})

    if not settings_doc:
        return UserSettingsResponse()

    return UserSettingsResponse(
        theme=settings_doc.get("theme", "system"),
        live_streaming=settings_doc.get("live_streaming", True),
        auto_save=settings_doc.get("auto_save", True),
        email_notifications=settings_doc.get("email_notifications", True),
        push_notifications=settings_doc.get("push_notifications", False),
        weekly_digest=settings_doc.get("weekly_digest", True),
        share_analytics=settings_doc.get("share_analytics", False),
        show_profile=settings_doc.get("show_profile", True),
    )


@router.put("/settings", response_model=UserSettingsResponse)
async def update_settings(data: UpdateSettingsRequest, current_user: dict = Depends(get_current_user)):
    """Update the current user's settings."""
    db = get_db()
    user_id = str(current_user["_id"])

    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    update_fields["user_id"] = user_id
    update_fields["updated_at"] = datetime.now(timezone.utc)

    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": update_fields},
        upsert=True,
    )

    settings_doc = await db.user_settings.find_one({"user_id": user_id})
    return UserSettingsResponse(
        theme=settings_doc.get("theme", "system"),
        live_streaming=settings_doc.get("live_streaming", True),
        auto_save=settings_doc.get("auto_save", True),
        email_notifications=settings_doc.get("email_notifications", True),
        push_notifications=settings_doc.get("push_notifications", False),
        weekly_digest=settings_doc.get("weekly_digest", True),
        share_analytics=settings_doc.get("share_analytics", False),
        show_profile=settings_doc.get("show_profile", True),
    )


# ─── Usage endpoints ───

@router.get("/usage")
async def get_usage(current_user: dict = Depends(get_current_user)):
    """Get the current user's AI usage stats with dynamic limit."""
    db = get_db()
    user_id = str(current_user["_id"])

    # Get today's usage
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    usage_doc = await db.ai_usage.find_one({"user_id": user_id, "date": today})
    calls_today = usage_doc.get("calls", 0) if usage_doc else 0

    # Get user's custom daily limit from settings (default 10)
    settings_doc = await db.user_settings.find_one({"user_id": user_id})
    daily_limit = settings_doc.get("ai_daily_limit", 10) if settings_doc else 10

    # Get recent call history
    recent_calls = []
    if usage_doc and "history" in usage_doc:
        recent_calls = usage_doc["history"][-10:]

    return {
        "calls_today": calls_today,
        "daily_limit": daily_limit,
        "remaining": max(0, daily_limit - calls_today),
        "plan": "free",
        "recent_calls": recent_calls,
    }


@router.post("/usage/record")
async def record_ai_call(
    tool: str = "Chat",
    current_user: dict = Depends(get_current_user),
):
    """Record an AI API call for the current user."""
    db = get_db()
    user_id = str(current_user["_id"])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now = datetime.now(timezone.utc)

    await db.ai_usage.update_one(
        {"user_id": user_id, "date": today},
        {
            "$inc": {"calls": 1},
            "$push": {"history": {"tool": tool, "timestamp": now.isoformat()}},
            "$setOnInsert": {"user_id": user_id, "date": today},
        },
        upsert=True,
    )

    usage_doc = await db.ai_usage.find_one({"user_id": user_id, "date": today})
    settings_doc = await db.user_settings.find_one({"user_id": user_id})
    daily_limit = settings_doc.get("ai_daily_limit", 10) if settings_doc else 10
    calls = usage_doc.get("calls", 0)

    return {
        "calls_today": calls,
        "daily_limit": daily_limit,
        "remaining": max(0, daily_limit - calls),
        "limit_reached": calls >= daily_limit,
    }
