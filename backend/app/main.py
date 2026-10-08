"""FastAPI application entry point."""
import os
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.auth import get_current_active_user

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
