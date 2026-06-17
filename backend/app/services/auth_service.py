from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId
import asyncio
import inspect
import jwt

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    create_password_reset_token,
    verify_password_reset_token,
)
from app.core.config import settings
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.utils.email import send_password_reset_email
from fastapi import HTTPException, status


class AuthService:
    async def _maybe_await(self, value):
        if inspect.isawaitable(value):
            return await value
        return value

    def _user_response(self, user: dict) -> UserResponse:
        return UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            username=user["username"],
            full_name=user.get("full_name"),
            is_active=user.get("is_active", True),
            is_verified=user.get("is_verified", False),
            avatar_url=user.get("avatar_url"),
            created_at=str(user["created_at"]),
        )

    async def _issue_tokens(self, db, user: dict) -> TokenResponse:
        user_id = str(user["_id"])
        access_token = create_access_token({"sub": user_id})
        refresh_token = create_refresh_token({"sub": user_id})

        await self._maybe_await(db.refresh_tokens.insert_one({
            "_id": str(ObjectId()),
            "token": refresh_token,
            "user_id": user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        }))

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=self._user_response(user),
        )

    async def register(self, data: RegisterRequest) -> TokenResponse:
        db = get_db()
        existing = await db.users.find_one(
            {"$or": [{"email": data.email}, {"username": data.username}]}
        )
        if existing:
            if existing["email"] == data.email:
                raise HTTPException(status_code=409, detail="Email already registered")
            raise HTTPException(status_code=409, detail="Username already taken")

        user_id = str(ObjectId())
        user_doc = {
            "_id": user_id,
            "email": data.email,
            "username": data.username,
            "hashed_password": await asyncio.to_thread(hash_password, data.password),
            "full_name": data.full_name,
            "is_active": True,
            "is_verified": False,
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user_doc)
        return await self._issue_tokens(db, user_doc)

    async def login(self, data: LoginRequest) -> TokenResponse:
        db = get_db()
        user = await db.users.find_one({"email": data.email})
        password_ok = (
            await asyncio.to_thread(verify_password, data.password, user["hashed_password"])
            if user
            else False
        )
        if not user or not password_ok:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not user.get("is_active"):
            raise HTTPException(status_code=403, detail="Account is disabled")

        return await self._issue_tokens(db, user)

    async def refresh_token(self, token: str) -> TokenResponse:
        db = get_db()
        try:
            payload = decode_token(token)
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Invalid token type")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Refresh token expired")
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        stored = await db.refresh_tokens.find_one({"token": token})
        if not stored:
            raise HTTPException(status_code=401, detail="Refresh token revoked")

        user_id = payload["sub"]
        await db.refresh_tokens.delete_one({"token": token})

        new_access = create_access_token({"sub": user_id})
        new_refresh = create_refresh_token({"sub": user_id})

        await db.refresh_tokens.insert_one({
            "_id": str(ObjectId()),
            "token": new_refresh,
            "user_id": user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        })

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(self, refresh_token: str) -> None:
        db = get_db()
        await db.refresh_tokens.delete_one({"token": refresh_token})

    async def forgot_password(self, email: str) -> None:
        db = get_db()
        user = await db.users.find_one({"email": email})
        if not user:
            return
        token = create_password_reset_token(email)
        await db.password_reset_tokens.insert_one({
            "_id": str(ObjectId()),
            "token": token,
            "email": email,
        })
        await send_password_reset_email(email, token)

    async def reset_password(self, token: str, new_password: str) -> None:
        email = verify_password_reset_token(token)
        if not email:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        db = get_db()
        stored = await db.password_reset_tokens.find_one({"token": token})
        if not stored:
            raise HTTPException(status_code=400, detail="Reset token already used")
        hashed_password = await asyncio.to_thread(hash_password, new_password)
        await db.users.update_one(
            {"email": email},
            {"$set": {"hashed_password": hashed_password, "updated_at": datetime.now(timezone.utc)}},
        )
        await db.password_reset_tokens.delete_one({"token": token})


auth_service = AuthService()
