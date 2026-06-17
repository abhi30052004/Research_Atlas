from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserResponse,
)
from app.services.auth_service import auth_service
from app.core.deps import get_current_user

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
async def register(data: RegisterRequest):
    return await auth_service.register(data)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    return await auth_service.login(data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest):
    return await auth_service.refresh_token(data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: RefreshRequest, current_user: dict = Depends(get_current_user)):
    await auth_service.logout(data.refresh_token)


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    await auth_service.forgot_password(data.email)
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    await auth_service.reset_password(data.token, data.new_password)
    return {"message": "Password reset successfully."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        username=current_user["username"],
        full_name=current_user.get("full_name"),
        is_active=current_user.get("is_active", True),
        is_verified=current_user.get("is_verified", False),
        avatar_url=current_user.get("avatar_url"),
        created_at=str(current_user["created_at"]),
    )
