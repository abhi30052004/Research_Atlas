from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response
import re
import time

from app.core.config import settings
from app.core.database import connect_db, disconnect_db
from app.core.redis import connect_redis, disconnect_redis
from app.api.v1 import auth, workspaces, sources, chat, notes, artifacts, search, analytics, exports, health, users

ATLAS_VERCEL_ORIGIN_REGEX = r"^https://atlas(-[a-z0-9]+)*\.vercel\.app$"


def build_cors_origin_regex() -> str:
    if settings.CORS_ORIGIN_REGEX:
        return f"(?:{settings.CORS_ORIGIN_REGEX})|(?:{ATLAS_VERCEL_ORIGIN_REGEX})"
    return ATLAS_VERCEL_ORIGIN_REGEX


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()
    yield
    await disconnect_db()
    await disconnect_redis()


app = FastAPI(
    title="Atlas AI",
    description="Atlas AI Research & Knowledge Management Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=build_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/")
async def api_root():
    return {
        "status": "ok",
        "service": "Atlas AI API",
        "health": "/api/v1/health",
        "docs": "/docs",
    }


def is_allowed_cors_origin(origin: str) -> bool:
    return bool(
        origin in settings.CORS_ORIGINS
        or re.fullmatch(ATLAS_VERCEL_ORIGIN_REGEX, origin)
        or (
            settings.CORS_ORIGIN_REGEX
            and re.fullmatch(settings.CORS_ORIGIN_REGEX, origin)
        )
    )


def add_cors_headers(response: Response, origin: str) -> Response:
    if is_allowed_cors_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Vary"] = "Origin"
    return response


@app.middleware("http")
async def preflight_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return add_cors_headers(JSONResponse(status_code=200, content={}), request.headers.get("origin", ""))
    return await call_next(request)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return add_cors_headers(response, request.headers.get("origin", ""))


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    from app.core.redis import redis_client
    if redis_client:
        client_ip = request.client.host
        key = f"rate_limit:{client_ip}"
        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, 60)
        if count > settings.RATE_LIMIT_PER_MINUTE:
            return JSONResponse(status_code=429, content={"detail": "Too many requests"})
    return await call_next(request)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    import traceback
    logger = logging.getLogger(__name__)
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    logger.error(traceback.format_exc())

    origin = request.headers.get("origin", "")
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__, "message": str(exc)},
    )
    # Add CORS headers so the browser can read the error
    return add_cors_headers(response, origin)


app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(workspaces.router, prefix="/api/v1/workspaces", tags=["Workspaces"])
app.include_router(sources.router, prefix="/api/v1/sources", tags=["Sources"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(notes.router, prefix="/api/v1/notes", tags=["Notes"])
app.include_router(artifacts.router, prefix="/api/v1/artifacts", tags=["Artifacts"])
app.include_router(exports.router, prefix="/api/v1/exports", tags=["Exports"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
