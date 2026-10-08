"""Presales Work Tracking API — lacak pekerjaan presales per jenis:
- BOM (Bill of Materials)
- Proposal Teknis
- Proposal RFP
- Proposal Lainnya
- POC (Proof of Concept)

Status alur kerja: todo → in_progress → review → done
Outcome (hasil akhir): pending → won (Close Won) / lost (Close Lost)

RBAC:
- Superadmin: full access (see all, filter by user)
- Presales: only see/create/edit/delete own work items
- Other roles (sales_rep, sales_manager): 403 Forbidden
"""
from datetime import datetime, date
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.models import PresalesWork, User, Opportunity
from app.auth import get_current_active_user

router = APIRouter(prefix="/presales-work", tags=["presales-work"])

# ---- Work type metadata ----
WORK_TYPES = [
    {
        "key": "bom",
        "label": "BOM",
        "description": "Bill of Materials — rincian kebutuhan hardware/software untuk solusi",
        "icon": "Boxes",
        "color": "#3b82f6",
    },
    {
        "key": "proposal_teknis",
        "label": "Proposal Teknis",
        "description": "Dokumen proposal teknis solusi, arsitektur, dan implementasi",
        "icon": "FileText",
        "color": "#8b5cf6",
    },
    {
        "key": "proposal_rfp",
        "label": "Proposal RFP",
        "description": "Jawaban RFP (Request for Proposal) dari customer/principal",
        "icon": "FileSignature",
        "color": "#0d9488",
    },
    {
        "key": "proposal_lainnya",
        "label": "Proposal Lainnya",
        "description": "Proposal komersial, RFQ, EOI, atau jenis proposal lainnya",
        "icon": "FileStack",
        "color": "#eab308",
    },
    {
        "key": "poc",
        "label": "POC",
        "description": "Proof of Concept — demo/pilot untuk membuktikan solusi",
        "icon": "FlaskConical",
        "color": "#f97316",
    },
]

WORK_TYPE_KEYS = {w["key"] for w in WORK_TYPES}
VALID_STATUSES = {"todo", "in_progress", "review", "done"}
VALID_OUTCOMES = {"pending", "won", "lost"}
VALID_PRIORITIES = {"low", "medium", "high", "urgent"}


# ---- Pydantic schemas ----
class PresalesWorkCreate(BaseModel):
    user_id: UUID | None = None
    opportunity_id: UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    work_type: str
    priority: str = "medium"
    status: str = "todo"
    outcome: str = "pending"
    outcome_notes: str | None = None
    due_date: date | None = None

    @field_validator("work_type")
    @classmethod
    def check_work_type(cls, v: str) -> str:
        if v not in WORK_TYPE_KEYS:
            raise ValueError(f"work_type harus salah satu dari: {', '.join(sorted(WORK_TYPE_KEYS))}")
        return v

    @field_validator("priority")
    @classmethod
    def check_priority(cls, v: str) -> str:
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority harus salah satu dari: {', '.join(sorted(VALID_PRIORITIES))}")
        return v

    @field_validator("status")
    @classmethod
    def check_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status harus salah satu dari: {', '.join(sorted(VALID_STATUSES))}")
        return v

    @field_validator("outcome")
    @classmethod
    def check_outcome(cls, v: str) -> str:
        if v not in VALID_OUTCOMES:
            raise ValueError(f"outcome harus salah satu dari: {', '.join(sorted(VALID_OUTCOMES))}")
        return v


class PresalesWorkUpdate(BaseModel):
    opportunity_id: UUID | None = None
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    work_type: str | None = None
    priority: str | None = None
    status: str | None = None
    outcome: str | None = None
    outcome_notes: str | None = None
    due_date: date | None = None

    @field_validator("work_type")
    @classmethod
    def check_work_type(cls, v: str | None) -> str | None:
        if v is not None and v not in WORK_TYPE_KEYS:
            raise ValueError(f"work_type harus salah satu dari: {', '.join(sorted(WORK_TYPE_KEYS))}")
        return v

    @field_validator("priority")
    @classmethod
    def check_priority(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"priority harus salah satu dari: {', '.join(sorted(VALID_PRIORITIES))}")
        return v

    @field_validator("status")
    @classmethod
    def check_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status harus salah satu dari: {', '.join(sorted(VALID_STATUSES))}")
        return v

    @field_validator("outcome")
    @classmethod
    def check_outcome(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_OUTCOMES:
            raise ValueError(f"outcome harus salah satu dari: {', '.join(sorted(VALID_OUTCOMES))}")
        return v


class PresalesWorkResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    user_name: str | None = None
    opportunity_id: UUID | None = None
    opportunity_name: str | None = None
    opportunity_value: float | None = None
    title: str
    description: str | None = None
    work_type: str
    priority: str
    status: str
    outcome: str
    outcome_notes: str | None = None
    due_date: date | None = None
    completed_at: datetime | None = None
    is_overdue: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


# ---- Helpers ----
def _to_response(work: PresalesWork, user_name: str | None = None,
                 opp_name: str | None = None, opp_value: float | None = None) -> dict:
    is_overdue = bool(
        work.due_date
        and work.status not in ("done",)
        and work.outcome == "pending"
        and work.due_date < date.today()
    )
    return {
        "id": str(work.id),
        "user_id": str(work.user_id) if work.user_id else None,
        "user_name": user_name,
        "opportunity_id": str(work.opportunity_id) if work.opportunity_id else None,
        "opportunity_name": opp_name,
        "opportunity_value": float(opp_value) if opp_value is not None else None,
        "title": work.title,
        "description": work.description,
        "work_type": work.work_type,
        "priority": work.priority,
        "status": work.status,
        "outcome": work.outcome,
        "outcome_notes": work.outcome_notes,
        "due_date": work.due_date.isoformat() if work.due_date else None,
        "completed_at": work.completed_at.isoformat() if work.completed_at else None,
        "is_overdue": is_overdue,
        "created_at": work.created_at.isoformat() if work.created_at else None,
        "updated_at": work.updated_at.isoformat() if work.updated_at else None,
    }


def _is_superadmin(user: User) -> bool:
    return user.is_superuser or user.role == "superadmin"


def _check_presales_access(user: User) -> None:
    """Only superadmin and presales role can access work tracking."""
    if _is_superadmin(user) or user.role == "presales":
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Akses ditolak. Tracking pekerjaan hanya untuk role presales dan superadmin.",
    )


async def _load_joined(db: AsyncSession, stmt):
    """Execute stmt joining User + Opportunity, return list of response dicts."""
    result = await db.execute(stmt)
    rows = result.all()
    return [_to_response(work, user_name, opp_name, opp_value)
            for work, user_name, opp_name, opp_value in rows]


# ---- Endpoints ----
@router.get("/meta")
async def get_meta(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Metadata jenis pekerjaan, status, dan outcome untuk form & filter."""
    _check_presales_access(current_user)
    return {
        "work_types": WORK_TYPES,
        "statuses": [
            {"key": "todo", "label": "To Do"},
            {"key": "in_progress", "label": "In Progress"},
            {"key": "review", "label": "Review"},
            {"key": "done", "label": "Done"},
        ],
        "outcomes": [
            {"key": "pending", "label": "Pending"},
            {"key": "won", "label": "Close Won"},
            {"key": "lost", "label": "Close Lost"},
        ],
        "priorities": [
            {"key": "low", "label": "Low"},
            {"key": "medium", "label": "Medium"},
            {"key": "high", "label": "High"},
            {"key": "urgent", "label": "Urgent"},
        ],
    }


@router.get("")
async def list_work(
    current_user: Annotated[User, Depends(get_current_active_user)],
    user_id: UUID | None = Query(None),
    opportunity_id: UUID | None = Query(None),
    work_type: str | None = Query(None),
    work_status: str | None = Query(None, alias="status"),
    outcome: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List pekerjaan presales dengan filter opsional.
    Superadmin: dapat filter user mana pun. Presales: hanya miliknya sendiri."""
    _check_presales_access(current_user)
    if not _is_superadmin(current_user):
        user_id = current_user.id

    stmt = (
        select(PresalesWork, User.name, Opportunity.name, Opportunity.value)
        .outerjoin(User, PresalesWork.user_id == User.id)
        .outerjoin(Opportunity, PresalesWork.opportunity_id == Opportunity.id)
    )

    conditions = []
    if user_id:
        conditions.append(PresalesWork.user_id == user_id)
    if opportunity_id:
        conditions.append(PresalesWork.opportunity_id == opportunity_id)
    if work_type:
        conditions.append(PresalesWork.work_type == work_type)
    if work_status:
        conditions.append(PresalesWork.status == work_status)
    if outcome:
        conditions.append(PresalesWork.outcome == outcome)
    if conditions:
        stmt = stmt.where(and_(*conditions))

    # Overdue & urgent first, then newest
    stmt = stmt.order_by(PresalesWork.created_at.desc())
    return await _load_joined(db, stmt)


@router.post("", status_code=201)
async def create_work(
    data: PresalesWorkCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Buat pekerjaan presales baru.
    Superadmin bisa assign ke user mana pun. Presales hanya untuk dirinya sendiri."""
    _check_presales_access(current_user)
    effective_user_id = data.user_id if _is_superadmin(current_user) else current_user.id

    # Validasi opportunity jika diisi
    if data.opportunity_id:
        opp = await db.get(Opportunity, data.opportunity_id)
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity tidak ditemukan")

    # Jika langsung di-set won/lost, status minimal done + set completed_at
    completed_at = datetime.utcnow() if data.outcome in ("won", "lost") else None

    work = PresalesWork(
        user_id=effective_user_id,
        opportunity_id=data.opportunity_id,
        title=data.title,
        description=data.description,
        work_type=data.work_type,
        priority=data.priority,
        status=data.status,
        outcome=data.outcome,
        outcome_notes=data.outcome_notes,
        due_date=data.due_date,
        completed_at=completed_at,
    )
    if data.outcome in ("won", "lost") and work.status == "todo":
        work.status = "done"
    db.add(work)
    await db.commit()
    await db.refresh(work)
    return _to_response(work)


@router.patch("/{work_id}")
async def update_work(
    work_id: UUID,
    data: PresalesWorkUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Update pekerjaan (status, outcome won/lost, dll).
    Superadmin bisa edit semua. Presales hanya miliknya sendiri."""
    _check_presales_access(current_user)
    work = await db.get(PresalesWork, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Pekerjaan tidak ditemukan")

    if not _is_superadmin(current_user) and work.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda hanya dapat mengubah pekerjaan milik Anda sendiri.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "opportunity_id" in update_data and update_data["opportunity_id"]:
        opp = await db.get(Opportunity, update_data["opportunity_id"])
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity tidak ditemukan")

    for field, value in update_data.items():
        setattr(work, field, value)

    # Auto logic: close won/lost → done + completed_at; reopen → clear completed_at
    if work.outcome in ("won", "lost"):
        if not work.completed_at:
            work.completed_at = datetime.utcnow()
        if work.status in ("todo",):
            work.status = "done"
    elif "outcome" in update_data:
        # Outcome kembali ke pending → reset completed_at
        work.completed_at = None

    await db.commit()
    await db.refresh(work)
    return _to_response(work)


@router.delete("/{work_id}", status_code=204)
async def delete_work(
    work_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Hapus pekerjaan. Superadmin bisa hapus semua. Presales hanya miliknya sendiri."""
    _check_presales_access(current_user)
    work = await db.get(PresalesWork, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Pekerjaan tidak ditemukan")

    if not _is_superadmin(current_user) and work.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda hanya dapat menghapus pekerjaan milik Anda sendiri.",
        )

    await db.delete(work)
    await db.commit()


@router.get("/summary")
async def get_summary(
    current_user: Annotated[User, Depends(get_current_active_user)],
    user_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Ringkasan per jenis pekerjaan + statistik close won/lost.
    Superadmin: semua / per user. Presales: miliknya sendiri."""
    _check_presales_access(current_user)
    if not _is_superadmin(current_user):
        user_id = current_user.id

    stmt = select(PresalesWork)
    if user_id:
        stmt = stmt.where(PresalesWork.user_id == user_id)
    result = await db.execute(stmt)
    works = result.scalars().all()

    today = date.today()
    type_map = {w["key"]: w for w in WORK_TYPES}

    by_type = []
    for wt in WORK_TYPES:
        items = [w for w in works if w.work_type == wt["key"]]
        by_type.append({
            **wt,
            "total": len(items),
            "todo": sum(1 for w in items if w.status == "todo"),
            "in_progress": sum(1 for w in items if w.status == "in_progress"),
            "review": sum(1 for w in items if w.status == "review"),
            "done": sum(1 for w in items if w.status == "done"),
            "won": sum(1 for w in items if w.outcome == "won"),
            "lost": sum(1 for w in items if w.outcome == "lost"),
            "overdue": sum(
                1 for w in items
                if w.due_date and w.status != "done" and w.outcome == "pending" and w.due_date < today
            ),
        })

    closed = [w for w in works if w.outcome in ("won", "lost")]
    win_rate = round(
        sum(1 for w in closed if w.outcome == "won") / len(closed) * 100, 1
    ) if closed else 0.0

    return {
        "work_types": by_type,
        "total": len(works),
        "total_todo": sum(1 for w in works if w.status == "todo"),
        "total_in_progress": sum(1 for w in works if w.status == "in_progress"),
        "total_review": sum(1 for w in works if w.status == "review"),
        "total_done": sum(1 for w in works if w.status == "done"),
        "total_won": sum(1 for w in works if w.outcome == "won"),
        "total_lost": sum(1 for w in works if w.outcome == "lost"),
        "total_pending": sum(1 for w in works if w.outcome == "pending"),
        "total_overdue": sum(
            1 for w in works
            if w.due_date and w.status != "done" and w.outcome == "pending" and w.due_date < today
        ),
        "win_rate": win_rate,
        "type_map": type_map,
    }
