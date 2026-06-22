from datetime import datetime, timedelta, timezone
from typing import Optional, Any
import jwt
import bcrypt

from app.core.config import settings


def hash_password(password: str) -> str:
    # bcrypt has a 72-byte limit; truncate to be safe
    pwd_bytes = password.encode("utf-8")[:72]
    # Minimum rounds (4) for near-instant login/register on Render free tier
    salt = bcrypt.gensalt(rounds=4)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def create_password_reset_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode(
        {"sub": email, "exp": expire, "type": "password_reset"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_password_reset_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "password_reset":
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def detect_prompt_injection(text: str) -> bool:
    injection_patterns = [
        "ignore previous instructions",
        "ignore all instructions",
        "disregard your",
        "forget your instructions",
        "you are now",
        "act as",
        "pretend you are",
        "system prompt",
        "bypass",
        "jailbreak",
    ]
    text_lower = text.lower()
    return any(pattern in text_lower for pattern in injection_patterns)
