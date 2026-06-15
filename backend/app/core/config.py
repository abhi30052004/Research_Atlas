from pydantic_settings import BaseSettings
from typing import List
import secrets


class Settings(BaseSettings):
    APP_NAME: str = "Atlas AI"
    DEBUG: bool = False
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "atlas_ai"

    REDIS_URL: str = "redis://localhost:6379"
    RATE_LIMIT_PER_MINUTE: int = 100

    OPENAI_API_KEY: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"
    OPENAI_DEFAULT_MODEL: str = "gpt-4o"

    GROQ_API_KEY: str = ""
    GROQ_DEFAULT_MODEL: str = "llama-3.3-70b-versatile"

    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    CELERY_TASK_ALWAYS_EAGER: bool = True

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: List[str] = ["pdf", "docx", "txt", "csv", "xlsx", "pptx"]

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://localhost:3000"]
    FRONTEND_URL: str = "http://localhost:3000"

    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    RETRIEVAL_TOP_K: int = 5

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@atlas-ai.com"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
