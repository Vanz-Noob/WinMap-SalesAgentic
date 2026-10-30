"""FastAPI application entry point."""
import logging
import os
import time

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.auth import get_current_active_user
from app.config import settings
from app.logging_config import setup_logging

setup_logging(level="DEBUG" if settings.DEBUG else "INFO")
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# CORS — allow production domain + localhost variants
_cors_origins = [
    "http://localhost",
    "http://localhost:80",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]
_extra = os.environ.get("CORS_ORIGINS", "")
if _extra:
    _cors_origins.extend(o.strip() for o in _extra.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _log_requests(request: Request, call_next):
    """Access log + unhandled exception log (OWASP A09). Tidak log headers/cookies."""
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "unhandled_error method=%s path=%s client=%s",
            request.method,
            request.url.path,
            getattr(request.client, "host", None),
        )
        raise
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "http_request method=%s path=%s status=%s duration_ms=%.1f client=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        getattr(request.client, "host", None),
    )
    return response


@app.get("/")
async def root():
    return {"app": settings.APP_NAME, "status": "running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


# --- Register Routers ---
from app.api.v1 import opportunities, stages, activities, tasks, accounts, dashboard, agents, presales_kpi, presales_work, auth, admin  # noqa: E402

# Auth dependency applied at router level — all endpoints require login by default
_auth = [Depends(get_current_active_user)]

app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(opportunities.router, prefix="/api/v1", dependencies=_auth)
app.include_router(stages.router, prefix="/api/v1", dependencies=_auth)
app.include_router(activities.router, prefix="/api/v1", dependencies=_auth)
app.include_router(tasks.router, prefix="/api/v1", dependencies=_auth)
app.include_router(accounts.router, prefix="/api/v1", dependencies=_auth)
app.include_router(dashboard.router, prefix="/api/v1", dependencies=_auth)
app.include_router(agents.router, prefix="/api/v1", dependencies=_auth)
app.include_router(presales_kpi.router, prefix="/api/v1", dependencies=_auth)
app.include_router(presales_work.router, prefix="/api/v1", dependencies=_auth)
