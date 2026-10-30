"""CRUD API for Opportunities."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import aliased
from app.db.database import get_db
from app.auth import can_view_all_data, get_current_active_user, opportunity_scope
from app.models import Opportunity, Stage, User
from app.schemas.opportunity import OpportunityCreate, OpportunityUpdate, OpportunityResponse
from typing import Annotated

# Threshold auto-stage mapping (win_probability → stage order)
# ≤10% → Prospecting (1), 11-25% → Qualification (2),
# 26-50% → Proposal (3), 51-70% → Negotiation (4)
# >70% → tetap di Negotiation (Closed Won harus manual)
WIN_PROB_THRESHOLDS = [
    (0.10, 1),   # ≤10% → Prospecting
    (0.25, 2),   # ≤25% → Qualification
    (0.50, 3),   # ≤50% → Proposal
    (0.70, 4),   # ≤70% → Negotiation
]


def get_stage_for_win_probability(win_prob: float, open_stages: list[Stage]) -> Stage | None:
    """Cari stage yang sesuai berdasarkan threshold win probability."""
    for threshold, stage_order in WIN_PROB_THRESHOLDS:
        if win_prob <= threshold:
            return next((s for s in open_stages if s.order == stage_order), None)
    # >70% → tetap di Negotiation (tidak auto-close)
    return next((s for s in open_stages if s.order == 4), None)

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

CurrentUser = Annotated[User, Depends(get_current_active_user)]


def _assert_can_access(opp: Opportunity, user: User):
    """404 jika user tidak berhak melihat opportunity ini (mencegah enumerasi)."""
    if can_view_all_data(user):
        return
    allowed = opp.owner_id == user.id or (
        user.role == "presales" and opp.presales_id == user.id
    )
    if not allowed:
        raise HTTPException(404, "Opportunity not found")


@router.get("", response_model=list[OpportunityResponse])
async def list_opportunities(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=200), db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    PresalesUser = aliased(User)
    query = (
        select(Opportunity, PresalesUser.name.label("presales_name"))
        .outerjoin(PresalesUser, Opportunity.presales_id == PresalesUser.id)
    )
    scope = opportunity_scope(current_user)
    if scope is not None:
        query = query.where(scope)
    result = await db.execute(
        query.order_by(Opportunity.created_at.desc()).offset(skip).limit(limit)
    )
    rows = result.all()
    responses = []
    for opp, presales_name in rows:
        resp = OpportunityResponse.model_validate(opp)
        resp.presales_name = presales_name
        responses.append(resp)
    return responses


@router.post("", response_model=OpportunityResponse, status_code=201)
async def create_opp(data: OpportunityCreate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    if not data.presales_id:
        raise HTTPException(status_code=422, detail="Presales wajib dipilih untuk setiap opportunity.")
    payload = data.model_dump()
    # Principal binding: non-superadmin/sales_manager selalu owner = requester,
    # owner_id dari client diabaikan.
    if not can_view_all_data(current_user):
        payload["owner_id"] = current_user.id
    opp = Opportunity(**payload)
    db.add(opp)
    await db.commit()
    await db.refresh(opp)
    return opp


@router.get("/{opp_id}", response_model=OpportunityResponse)
async def get_opp(opp_id: str, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    PresalesUser = aliased(User)
    query = (
        select(Opportunity, PresalesUser.name.label("presales_name"))
        .outerjoin(PresalesUser, Opportunity.presales_id == PresalesUser.id)
        .where(Opportunity.id == opp_id)
    )
    scope = opportunity_scope(current_user)
    if scope is not None:
        query = query.where(scope)
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(404, "Opportunity not found")
    opp, presales_name = row
    resp = OpportunityResponse.model_validate(opp)
    resp.presales_name = presales_name
    return resp


@router.patch("/{opp_id}", response_model=OpportunityResponse)
async def update_opp(opp_id: str, data: OpportunityUpdate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    opp = await db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    _assert_can_access(opp, current_user)

    update_data = data.model_dump(exclude_unset=True)

    # Non-superadmin/sales_manager tidak boleh reassign owner ke user lain
    if not can_view_all_data(current_user):
        update_data.pop("owner_id", None)

    # Auto-stage berdasarkan win probability threshold
    # Hanya auto-update jika user tidak secara eksplisit mengubah stage_id
    if "win_probability" in update_data and "stage_id" not in update_data:
        win_prob = float(update_data["win_probability"])
        # Clamp ke 0-1
        win_prob = max(0.0, min(1.0, win_prob))

        # Ambil semua open stages (bukan closed)
        stages_result = await db.execute(
            select(Stage).where(Stage.is_closed.is_(False)).order_by(Stage.order)
        )
        open_stages = stages_result.scalars().all()

        if open_stages:
            new_stage = get_stage_for_win_probability(win_prob, open_stages)
            if new_stage and new_stage.id != opp.stage_id:
                update_data["stage_id"] = new_stage.id

    for k, v in update_data.items():
        setattr(opp, k, v)

    await db.commit()
    await db.refresh(opp)

    # Ambil presales_name langsung dari tabel users
    presales_name = None
    if opp.presales_id:
        presales_result = await db.execute(
            select(User.name).where(User.id == opp.presales_id)
        )
        presales_name = presales_result.scalar_one_or_none()

    resp = OpportunityResponse.model_validate(opp)
    resp.presales_name = presales_name
    return resp


@router.delete("/{opp_id}", status_code=204)
async def delete_opp(opp_id: str, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    opp = await db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    _assert_can_access(opp, current_user)
    await db.delete(opp)
    await db.commit()
