from pydantic import BaseModel
from typing import Optional


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UpdateSettingsRequest(BaseModel):
    theme: Optional[str] = None  # "light", "dark", "system"
    live_streaming: Optional[bool] = None
    auto_save: Optional[bool] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    weekly_digest: Optional[bool] = None
    share_analytics: Optional[bool] = None
    show_profile: Optional[bool] = None


class UserSettingsResponse(BaseModel):
    theme: str = "system"
    live_streaming: bool = True
    auto_save: bool = True
    email_notifications: bool = True
    push_notifications: bool = False
    weekly_digest: bool = True
    share_analytics: bool = False
    show_profile: bool = True
