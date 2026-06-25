from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId
import asyncio
import inspect
import re
import jwt
import requests

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
    FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

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

    def _normalize_username(self, value: str) -> str:
        cleaned = re.sub(r"[^a-zA-Z0-9_]+", "_", value).strip("_").lower()
        if len(cleaned) < 3:
            cleaned = f"user_{cleaned}" if cleaned else "user"
        return cleaned[:30]

    async def _unique_username(self, db, preferred: str) -> str:
        base = self._normalize_username(preferred)
        username = base
        attempt = 0
        while await db.users.find_one({"username": username}):
            attempt += 1
            suffix = f"_{attempt}"
            max_base_len = 30 - len(suffix)
            username = f"{base[:max_base_len]}{suffix}"
        return username

    def _verify_firebase_id_token(self, id_token: str) -> dict:
        project_id = settings.FIREBASE_PROJECT_ID
        if not project_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Firebase project is not configured on the server",
            )

        try:
            header = jwt.get_unverified_header(id_token)
            kid = header.get("kid")
            if not kid:
                raise HTTPException(status_code=401, detail="Invalid Firebase token header")

            certs_resp = requests.get(self.FIREBASE_CERTS_URL, timeout=10)
            certs_resp.raise_for_status()
            certs = certs_resp.json()
            cert = certs.get(kid)
            if not cert:
                raise HTTPException(status_code=401, detail="Firebase key id not recognized")

            issuer = f"https://securetoken.google.com/{project_id}"
            payload = jwt.decode(
                id_token,
                cert,
                algorithms=["RS256"],
                audience=project_id,
                issuer=issuer,
            )
            if not payload.get("sub"):
                raise HTTPException(status_code=401, detail="Invalid Firebase token subject")
            return payload
        except HTTPException:
            raise
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Firebase token expired")
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="Invalid Firebase token")
        except requests.RequestException:
            raise HTTPException(status_code=503, detail="Unable to verify Firebase token")

    async def login(self, data: LoginRequest) -> TokenResponse:
        db = get_db()
        user = await db.users.find_one({"email": data.email})
        password_ok = (
            await asyncio.to_thread(verify_password, data.password, user["hashed_password"])
            if user and user.get("hashed_password")
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

    async def google_login(self, id_token: str) -> TokenResponse:
        db = get_db()
        payload = await asyncio.to_thread(self._verify_firebase_id_token, id_token)

        email = (payload.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Google account email is required")

        full_name = payload.get("name")
        avatar_url = payload.get("picture")
        is_verified = bool(payload.get("email_verified"))
        firebase_uid = payload.get("sub")

        user = await db.users.find_one({"email": email})
        now = datetime.now(timezone.utc)

        if user:
            update_fields = {
                "updated_at": now,
                "is_verified": user.get("is_verified", False) or is_verified,
                "firebase_uid": firebase_uid,
            }
            if full_name and not user.get("full_name"):
                update_fields["full_name"] = full_name
            if avatar_url and not user.get("avatar_url"):
                update_fields["avatar_url"] = avatar_url

            await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
            user = await db.users.find_one({"_id": user["_id"]})
        else:
            preferred_username = email.split("@", 1)[0]
            username = await self._unique_username(db, preferred_username)
            user = {
                "_id": str(ObjectId()),
                "email": email,
                "username": username,
                "hashed_password": None,
                "full_name": full_name,
                "is_active": True,
                "is_verified": is_verified,
                "avatar_url": avatar_url,
                "firebase_uid": firebase_uid,
                "created_at": now,
                "updated_at": now,
            }
            await db.users.insert_one(user)

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
