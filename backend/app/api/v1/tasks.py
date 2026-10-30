"""CRUD API for Tasks."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.auth import can_view_all_data, get_current_active_user
from app.models import Task, User
from app.schemas.common import TaskCreate, TaskUpdate, TaskResponse
from typing import Annotated

router = APIRouter(prefix="/tasks", tags=["tasks"])

CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    opp_id: str | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(Task).order_by(Task.created_at.desc())
    if opp_id:
        query = query.where(Task.opp_id == opp_id)
    if status:
        query = query.where(Task.status == status)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    payload = data.model_dump()
    # Principal binding: non-superadmin/sales_manager hanya bisa assign task ke diri sendiri.
    if not can_view_all_data(current_user):
        payload["assigned_to"] = current_user.id
    task = Task(**payload)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, data: TaskUpdate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    update_data = data.model_dump(exclude_unset=True)
    # Non-superadmin/sales_manager tidak boleh reassign task ke user lain
    if not can_view_all_data(current_user):
        update_data.pop("assigned_to", None)
    for k, v in update_data.items():
        setattr(task, k, v)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    await db.delete(task)
    await db.commit()
