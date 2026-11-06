"""API endpoints for triggering AI agents."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.agents.opportunity_agent import run_opportunity_agent
from app.agents.pipeline_agent import run_pipeline_agent
from app.agents.insight_agent import generate_daily_briefing
from app.agents.export_agent import run_export_agent
from app.auth import get_current_active_user
from app.models import User
from app.rate_limit import rate_limit_user
from pydantic import BaseModel, Field
from typing import Annotated, Literal

router = APIRouter(prefix="/agents", tags=["agents"])


CurrentUser = Annotated[User, Depends(get_current_active_user)]
# Endpoint agents memakai LLM (mahal) — rate limit per-user.
RateLimited = Annotated[None, Depends(rate_limit_user("agents", limit=20, window=60))]


class AgentTrigger(BaseModel):
    # Batas panjang membatasi biaya LLM & permukaan prompt injection.
    raw_input: str = Field(min_length=1, max_length=20000)


class ExportTrigger(BaseModel):
    data_type: Literal["pipeline", "presales"] = "pipeline"
    stage_filter: str | None = Field(None, max_length=100)
    owner_id: uuid.UUID | None = None
    category: str | None = Field(None, max_length=100)
    quarter: str | None = Field(None, pattern=r"^Q[1-4]$")
    year: int | None = Field(None, ge=2000, le=2100)
    presales_user_id: uuid.UUID | None = None
    file_format: Literal["csv", "excel", "pdf"] = "csv"


@router.post("/opportunity/run")
async def trigger_opportunity_agent(data: AgentTrigger, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None, _rl: RateLimited = None):
    """Trigger Opportunity Agent dengan raw input (email, meeting note, dll)."""
    return await run_opportunity_agent(data.raw_input, db, current_user)


@router.post("/pipeline/scan")
async def trigger_pipeline_agent(limit: int = Query(10, ge=1, le=50), db: AsyncSession = Depends(get_db), current_user: CurrentUser = None, _rl: RateLimited = None):
    """Scan pipeline & generate recommendations (default 10, maks 50 deals per run —
    cap mencegah unbounded LLM spend per request)."""
    return await run_pipeline_agent(db, current_user, limit=limit)


@router.get("/insight/briefing")
async def get_daily_briefing(db: AsyncSession = Depends(get_db), current_user: CurrentUser = None, _rl: RateLimited = None):
    """Get daily insight briefing."""
    return await generate_daily_briefing(db, current_user)


@router.post("/export/run")
async def trigger_export_agent(data: ExportTrigger, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None, _rl: RateLimited = None):
    """
    Trigger Export Agent — export pipeline or presales data to CSV/Excel/PDF with AI summary.

    data_type:
      - "pipeline": Export opportunities (sales pipeline) — CSV only
      - "presales": Export presales KPI tracking data — CSV / Excel (chart) / PDF (chart)

    Pipeline filters: stage_filter ("all", "open", "closed_won", "closed_lost", or stage name), owner_id
    Presales filters: category ("all" or specific), quarter ("Q3"), year (2026),
      presales_user_id (filter nama presales), file_format ("csv" | "excel" | "pdf")
    """
    return await run_export_agent(
        db,
        current_user,
        data_type=data.data_type,
        stage_filter=data.stage_filter,
        owner_id=data.owner_id,
        category=data.category,
        quarter=data.quarter,
        year=data.year,
        presales_user_id=data.presales_user_id,
        file_format=data.file_format,
    )
