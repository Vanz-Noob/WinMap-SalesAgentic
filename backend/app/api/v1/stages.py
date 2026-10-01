"""API for pipeline stages."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Stage
from app.schemas.common import StageResponse

router = APIRouter(prefix="/stages", tags=["stages"])


@router.get("", response_model=list[StageResponse])
async def list_stages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stage).order_by(Stage.order))
    return result.scalars().all()
