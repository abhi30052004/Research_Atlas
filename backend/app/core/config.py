from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import List, Optional
import secrets
from urllib.parse import urlsplit, urlunsplit


def _redis_url_with_db(redis_url: str, db: int) -> str:
    parts = urlsplit(redis_url)
    return urlunsplit((parts.scheme, parts.netloc, f"/{db}", parts.query, parts.fragment))


class Settings(BaseSettings):
    APP_NAME: str = "Atlas AI"
    DEBUG: bool = False
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "atlas_ai"

    REDIS_URL: str = "redis://localhost:6379"
    RATE_LIMIT_PER_MINUTE: int = 100

    OPENAI_API_KEY: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_EMBEDDING_DIMENSIONS: Optional[int] = 768
    OPENAI_DEFAULT_MODEL: str = "gpt-4o"

    GROQ_API_KEY: str = ""
    GROQ_DEFAULT_MODEL: str = "llama-3.3-70b-versatile"

    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""
    CELERY_TASK_ALWAYS_EAGER: bool = False

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: List[str] = ["pdf", "docx", "txt", "csv", "xlsx", "pptx"]

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://localhost:3000",
        "http://localhost:5173",
        "https://atlas-swart-kappa-13.vercel.app",
        "https://atlas-dm2kl19dk-abhibhunia68-2333s-projects.vercel.app",
    ]
    CORS_ORIGIN_REGEX: str = r"^https://atlas-[a-z0-9-]+-abhibhunia68-2333s-projects\.vercel\.app$"
    FRONTEND_URL: str = "https://atlas-swart-kappa-13.vercel.app"

    CHUNK_SIZE: int = 2200
    CHUNK_OVERLAP: int = 100
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_MIN_RELEVANCE: float = 0.25
    ARTIFACT_RETRIEVAL_TOP_K: int = 18
    EMBEDDING_BATCH_SIZE: int = 256
    EMBEDDING_CONCURRENCY: int = 4
    CHROMA_ADD_BATCH_SIZE: int = 256
    SOURCE_CHUNK_INSERT_BATCH_SIZE: int = 500
    SOURCE_INDEX_DB_BATCH_SIZE: int = 256
    SOURCE_INDEX_BATCH_CONCURRENCY: int = 4
    SEARCH_LEGACY_COLLECTIONS: bool = True
    LEGACY_EMBEDDING_MODEL: str = "text-embedding-3-large"
    LEGACY_EMBEDDING_DIMENSIONS: Optional[int] = None
    SOURCE_FAST_READY_BEFORE_EMBEDDING: bool = True
    SOURCE_DETACH_EMBEDDING_INDEX: bool = True
    KEYWORD_FALLBACK_CHUNK_LIMIT: int = 1000
    STALE_PENDING_REQUEUE_SECONDS: int = 120
    STALE_PROCESSING_REQUEUE_SECONDS: int = 900

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@atlas-ai.com"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @model_validator(mode="after")
    def set_derived_urls(self):
        if not self.CELERY_BROKER_URL:
            self.CELERY_BROKER_URL = _redis_url_with_db(self.REDIS_URL, 0)
        if not self.CELERY_RESULT_BACKEND:
            self.CELERY_RESULT_BACKEND = _redis_url_with_db(self.REDIS_URL, 1)
        return self


settings = Settings()
