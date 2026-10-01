"""CRUD API for Opportunities."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import aliased
from app.db.database import get_db
from app.models import Opportunity, Stage, User
from app.schemas.opportunity import OpportunityCreate, OpportunityUpdate, OpportunityResponse

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


@router.get("", response_model=list[OpportunityResponse])
async def list_opportunities(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    PresalesUser = aliased(User)
    result = await db.execute(
        select(Opportunity, PresalesUser.name.label("presales_name"))
        .outerjoin(PresalesUser, Opportunity.presales_id == PresalesUser.id)
        .order_by(Opportunity.created_at.desc())
        .offset(skip).limit(limit)
    )
    rows = result.all()
    responses = []
    for opp, presales_name in rows:
        resp = OpportunityResponse.model_validate(opp)
        resp.presales_name = presales_name
        responses.append(resp)
    return responses


@router.post("", response_model=OpportunityResponse, status_code=201)
async def create_opp(data: OpportunityCreate, db: AsyncSession = Depends(get_db)):
    if not data.presales_id:
        raise HTTPException(status_code=422, detail="Presales wajib dipilih untuk setiap opportunity.")
    opp = Opportunity(**data.model_dump())
    db.add(opp)
    await db.commit()
    await db.refresh(opp)
    return opp


@router.get("/{opp_id}", response_model=OpportunityResponse)
async def get_opp(opp_id: str, db: AsyncSession = Depends(get_db)):
    PresalesUser = aliased(User)
    result = await db.execute(
        select(Opportunity, PresalesUser.name.label("presales_name"))
        .outerjoin(PresalesUser, Opportunity.presales_id == PresalesUser.id)
        .where(Opportunity.id == opp_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Opportunity not found")
    opp, presales_name = row
    resp = OpportunityResponse.model_validate(opp)
    resp.presales_name = presales_name
    return resp


@router.patch("/{opp_id}", response_model=OpportunityResponse)
async def update_opp(opp_id: str, data: OpportunityUpdate, db: AsyncSession = Depends(get_db)):
    opp = await db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    update_data = data.model_dump(exclude_unset=True)

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
    return opp


@router.delete("/{opp_id}", status_code=204)
async def delete_opp(opp_id: str, db: AsyncSession = Depends(get_db)):
    opp = await db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    await db.delete(opp)
    await db.commit()
