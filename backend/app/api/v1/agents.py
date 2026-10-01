"""API endpoints for triggering AI agents."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.agents.opportunity_agent import run_opportunity_agent
from app.agents.pipeline_agent import run_pipeline_agent
from app.agents.insight_agent import generate_daily_briefing
from app.agents.export_agent import run_export_agent
from pydantic import BaseModel
from typing import Literal

router = APIRouter(prefix="/agents", tags=["agents"])


class AgentTrigger(BaseModel):
    raw_input: str


class ExportTrigger(BaseModel):
    data_type: Literal["pipeline", "presales"] = "pipeline"
    stage_filter: str | None = None
    owner_id: str | None = None
    category: str | None = None
    quarter: str | None = None
    year: int | None = None


@router.post("/opportunity/run")
async def trigger_opportunity_agent(data: AgentTrigger, db: AsyncSession = Depends(get_db)):
    """Trigger Opportunity Agent dengan raw input (email, meeting note, dll)."""
    return await run_opportunity_agent(data.raw_input, db)


@router.post("/pipeline/scan")
async def trigger_pipeline_agent(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Scan pipeline & generate recommendations (default 10 deals per run)."""
    return await run_pipeline_agent(db, limit=limit)


@router.get("/insight/briefing")
async def get_daily_briefing(db: AsyncSession = Depends(get_db)):
    """Get daily insight briefing."""
    return await generate_daily_briefing(db)


@router.post("/export/run")
async def trigger_export_agent(data: ExportTrigger, db: AsyncSession = Depends(get_db)):
    """
    Trigger Export Agent — export pipeline or presales data to CSV with AI summary.

    data_type:
      - "pipeline": Export opportunities (sales pipeline)
      - "presales": Export presales KPI tracking data

    Pipeline filters: stage_filter ("all", "open", "closed_won", "closed_lost", or stage name), owner_id
    Presales filters: category ("all" or specific), quarter ("Q3"), year (2026)
    """
    return await run_export_agent(
        db,
        data_type=data.data_type,
        stage_filter=data.stage_filter,
        owner_id=data.owner_id,
        category=data.category,
        quarter=data.quarter,
        year=data.year,
    )
