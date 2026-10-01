"""CRUD API for Activities."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Activity
from app.schemas.common import ActivityCreate, ActivityResponse

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=list[ActivityResponse])
async def list_activities(opp_id: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Activity).order_by(Activity.created_at.desc())
    if opp_id:
        query = query.where(Activity.opp_id == opp_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ActivityResponse, status_code=201)
async def create_activity(data: ActivityCreate, db: AsyncSession = Depends(get_db)):
    activity = Activity(**data.model_dump())
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(activity_id: str, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(404, "Activity not found")
    await db.delete(activity)
    await db.commit()
