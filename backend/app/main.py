"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:80",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ],
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
from app.api.v1 import opportunities, stages, activities, tasks, accounts, dashboard, agents, presales_kpi, auth  # noqa: E402

app.include_router(auth.router, prefix="/api/v1")
app.include_router(opportunities.router, prefix="/api/v1")
app.include_router(stages.router, prefix="/api/v1")
app.include_router(activities.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(presales_kpi.router, prefix="/api/v1")
