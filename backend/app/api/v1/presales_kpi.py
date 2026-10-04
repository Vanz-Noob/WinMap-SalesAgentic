"""Presales KPI Tracking API — 6 categories:
- Bundling Solution
- Marketing Activities
- Certification
- Relationship with Principal
- Upselling & Cross-selling
- Response Time

RBAC:
- Superadmin: full access (see all presales KPIs, filter by user)
- Presales: only see/create/edit/delete own KPIs
- Other roles (sales_rep, sales_manager): 403 Forbidden
"""
from datetime import datetime
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.models import PresalesKpi, User
from app.auth import get_current_active_user

router = APIRouter(prefix="/presales-kpi", tags=["presales-kpi"])

# ---- Category metadata ----
CATEGORIES = [
    {
        "key": "bundling_solution",
        "label": "Bundling Solution",
        "description": "Initiate bundling solution from partner or other brand together with product team",
        "icon": "Package",
        "color": "#3b82f6",
    },
    {
        "key": "marketing_activities",
        "label": "Marketing Activities",
        "description": "Marketing activities & campaigns",
        "icon": "Megaphone",
        "color": "#8b5cf6",
    },
    {
        "key": "certification",
        "label": "Certification",
        "description": "Additional certification (ACA, ACP, ACE, or equivalent)",
        "icon": "Award",
        "color": "#059669",
    },
    {
        "key": "relationship_principal",
        "label": "Relationship with Principal",
        "description": "Engagement & relationship building with principals",
        "icon": "Handshake",
        "color": "#0d9488",
    },
    {
        "key": "upselling_cross_selling",
        "label": "Upselling & Cross-selling",
        "description": "Do upselling & cross selling — 2 pipeline per Q (focus products & solution)",
        "icon": "TrendingUp",
        "color": "#eab308",
    },
    {
        "key": "response_time",
        "label": "Response Time",
        "description": "Response time via WhatsApp, call, email (1×24 hours), negative checking",
        "icon": "Clock",
        "color": "#ef4444",
    },
]


# ---- Pydantic schemas ----
class PresalesKpiCreate(BaseModel):
    user_id: UUID | None = None
    category: str
    item_name: str
    description: str | None = None
    target: float = 0
    actual: float = 0
    unit: str = "count"
    quarter: str = "Q3"
    year: int = 2026
    status: str = "in_progress"
    notes: str | None = None


class PresalesKpiUpdate(BaseModel):
    actual: float | None = None
    status: str | None = None
    notes: str | None = None
    target: float | None = None


class PresalesKpiResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    user_name: str | None = None
    category: str
    item_name: str
    description: str | None = None
    target: float
    actual: float
    unit: str
    quarter: str
    year: int
    status: str
    notes: str | None = None
    progress: float
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


# ---- Helpers ----
def _to_response(kpi: PresalesKpi, user_name: str | None = None) -> dict:
    progress = 0.0
    if kpi.target and kpi.target > 0:
        progress = round((float(kpi.actual) / float(kpi.target)) * 100, 1)
    return {
        "id": str(kpi.id),
        "user_id": str(kpi.user_id) if kpi.user_id else None,
        "user_name": user_name,
        "category": kpi.category,
        "item_name": kpi.item_name,
        "description": kpi.description,
        "target": float(kpi.target),
        "actual": float(kpi.actual),
        "unit": kpi.unit,
        "quarter": kpi.quarter,
        "year": kpi.year,
        "status": kpi.status,
        "notes": kpi.notes,
        "progress": min(progress, 100.0),
        "created_at": kpi.created_at.isoformat() if kpi.created_at else None,
        "updated_at": kpi.updated_at.isoformat() if kpi.updated_at else None,
    }


# ---- RBAC helpers ----
def _is_superadmin(user: User) -> bool:
    return user.is_superuser or user.role == "superadmin"


def _check_presales_access(user: User) -> None:
    """Only superadmin and presales role can access presales KPI features.
    Other roles (sales_rep, sales_manager) get 403.
    """
    if _is_superadmin(user) or user.role == "presales":
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Akses ditolak. Presales tracking hanya untuk role presales dan superadmin.",
    )


# ---- Endpoints ----
@router.get("/categories")
async def get_categories(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Return metadata for all 6 presales KPI categories."""
    _check_presales_access(current_user)
    return CATEGORIES


@router.get("")
async def list_kpis(
    current_user: Annotated[User, Depends(get_current_active_user)],
    user_id: UUID | None = Query(None),
    category: str | None = Query(None),
    quarter: str | None = Query(None),
    year: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List presales KPIs with optional filters.
    Superadmin: can filter by any user_id. Presales: forced to own user_id only.
    """
    _check_presales_access(current_user)
    # Presales users can only see their own KPIs
    if not _is_superadmin(current_user):
        user_id = current_user.id

    stmt = select(PresalesKpi, User.name).outerjoin(User, PresalesKpi.user_id == User.id)

    conditions = []
    if user_id:
        conditions.append(PresalesKpi.user_id == user_id)
    if category:
        conditions.append(PresalesKpi.category == category)
    if quarter:
        conditions.append(PresalesKpi.quarter == quarter)
    if year:
        conditions.append(PresalesKpi.year == year)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(PresalesKpi.category, PresalesKpi.created_at)
    result = await db.execute(stmt)
    rows = result.all()

    return [_to_response(kpi, user_name) for kpi, user_name in rows]


@router.post("", status_code=201)
async def create_kpi(
    kpi_data: PresalesKpiCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new presales KPI item.
    Superadmin can assign to any user. Presales users can only create for themselves.
    """
    _check_presales_access(current_user)
    effective_user_id = kpi_data.user_id if _is_superadmin(current_user) else current_user.id

    kpi = PresalesKpi(
        user_id=effective_user_id,
        category=kpi_data.category,
        item_name=kpi_data.item_name,
        description=kpi_data.description,
        target=kpi_data.target,
        actual=kpi_data.actual,
        unit=kpi_data.unit,
        quarter=kpi_data.quarter,
        year=kpi_data.year,
        status=kpi_data.status,
        notes=kpi_data.notes,
    )
    db.add(kpi)
    await db.commit()
    await db.refresh(kpi)
    return _to_response(kpi)


@router.patch("/{kpi_id}")
async def update_kpi(
    kpi_id: UUID,
    kpi_update: PresalesKpiUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Update a presales KPI item (actual, status, notes, target).
    Superadmin can edit any. Presales users can only edit their own.
    """
    _check_presales_access(current_user)
    kpi = await db.get(PresalesKpi, kpi_id)
    if not kpi:
        raise HTTPException(status_code=404, detail="Presales KPI not found")

    # Presales users can only edit their own KPIs
    if not _is_superadmin(current_user) and kpi.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda hanya dapat mengubah KPI milik Anda sendiri.",
        )

    update_data = kpi_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kpi, field, value)

    # Auto-update status based on progress
    if kpi.target and kpi.target > 0:
        progress = (float(kpi.actual) / float(kpi.target)) * 100
        if progress >= 100 and kpi.status not in ("achieved", "overdue"):
            kpi.status = "achieved"
        elif progress > 0 and kpi.status == "not_started":
            kpi.status = "in_progress"

    await db.commit()
    await db.refresh(kpi)
    return _to_response(kpi)


@router.delete("/{kpi_id}", status_code=204)
async def delete_kpi(
    kpi_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Delete a presales KPI item.
    Superadmin can delete any. Presales users can only delete their own.
    """
    _check_presales_access(current_user)
    kpi = await db.get(PresalesKpi, kpi_id)
    if not kpi:
        raise HTTPException(status_code=404, detail="Presales KPI not found")

    # Presales users can only delete their own KPIs
    if not _is_superadmin(current_user) and kpi.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda hanya dapat menghapus KPI milik Anda sendiri.",
        )

    await db.delete(kpi)
    await db.commit()


@router.get("/summary")
async def get_summary(
    current_user: Annotated[User, Depends(get_current_active_user)],
    quarter: str | None = Query(None),
    year: int | None = Query(None),
    user_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Summary of all presales KPI categories with progress per category + overall score.
    Superadmin: can filter by any user_id. Presales: forced to own user_id only.
    """
    _check_presales_access(current_user)
    # Presales users can only see their own KPIs
    if not _is_superadmin(current_user):
        user_id = current_user.id

    stmt = select(PresalesKpi)
    conditions = []
    if quarter:
        conditions.append(PresalesKpi.quarter == quarter)
    if year:
        conditions.append(PresalesKpi.year == year)
    if user_id:
        conditions.append(PresalesKpi.user_id == user_id)
    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt)
    kpis = result.scalars().all()

    # Group by category
    category_map = {c["key"]: c for c in CATEGORIES}
    categories_summary = []
    total_progress = 0
    active_categories = 0

    for cat in CATEGORIES:
        cat_kpis = [k for k in kpis if k.category == cat["key"]]
        if not cat_kpis:
            categories_summary.append({
                **cat,
                "total_items": 0,
                "achieved_items": 0,
                "in_progress_items": 0,
                "overdue_items": 0,
                "avg_progress": 0,
                "items": [],
            })
            continue

        achieved = sum(1 for k in cat_kpis if k.status == "achieved")
        in_progress = sum(1 for k in cat_kpis if k.status == "in_progress")
        overdue = sum(1 for k in cat_kpis if k.status == "overdue")

        progresses = []
        for k in cat_kpis:
            if k.target and k.target > 0:
                p = min((float(k.actual) / float(k.target)) * 100, 100.0)
            elif k.status == "achieved":
                p = 100.0
            else:
                p = 0.0
            progresses.append(p)

        avg_progress = round(sum(progresses) / len(progresses), 1) if progresses else 0
        total_progress += avg_progress
        active_categories += 1

        categories_summary.append({
            **cat,
            "total_items": len(cat_kpis),
            "achieved_items": achieved,
            "in_progress_items": in_progress,
            "overdue_items": overdue,
            "avg_progress": avg_progress,
            "items": [_to_response(k) for k in cat_kpis],
        })

    overall_score = round(total_progress / len(CATEGORIES), 1) if CATEGORIES else 0

    return {
        "categories": categories_summary,
        "overall_score": overall_score,
        "total_items": len(kpis),
        "total_achieved": sum(1 for k in kpis if k.status == "achieved"),
        "total_in_progress": sum(1 for k in kpis if k.status == "in_progress"),
        "total_overdue": sum(1 for k in kpis if k.status == "overdue"),
        "quarter": quarter or "all",
        "year": year or "all",
    }
