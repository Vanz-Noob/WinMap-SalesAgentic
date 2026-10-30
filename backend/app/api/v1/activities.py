"""CRUD API for Activities."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.auth import get_current_active_user
from app.models import Activity, User
from app.schemas.common import ActivityCreate, ActivityResponse
from typing import Annotated

router = APIRouter(prefix="/activities", tags=["activities"])

CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.get("", response_model=list[ActivityResponse])
async def list_activities(
    opp_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(Activity).order_by(Activity.created_at.desc())
    if opp_id:
        query = query.where(Activity.opp_id == opp_id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=ActivityResponse, status_code=201)
async def create_activity(data: ActivityCreate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    payload = data.model_dump()
    # Principal binding: created_by selalu requester, nilai client diabaikan.
    payload["created_by"] = current_user.id
    activity = Activity(**payload)
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
