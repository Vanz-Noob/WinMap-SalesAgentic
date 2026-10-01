"""Dashboard API: aggregated metrics for frontend & Tableau."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.db.database import get_db
from app.models import Opportunity, Stage, User, Activity, Account

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _refresh_materialized_views(db: AsyncSession):
    """Refresh materialized views agar data selalu up-to-date."""
    try:
        await db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_summary"))
        await db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_forecast_data"))
        await db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rep_performance"))
        await db.commit()
    except Exception:
        # If CONCURRENTLY fails (e.g., first run), try without it
        await db.rollback()
        try:
            await db.execute(text("REFRESH MATERIALIZED VIEW mv_funnel_summary"))
            await db.execute(text("REFRESH MATERIALIZED VIEW mv_forecast_data"))
            await db.execute(text("REFRESH MATERIALIZED VIEW mv_rep_performance"))
            await db.commit()
        except Exception:
            await db.rollback()


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    """Pipeline summary: total value, deal count, avg probability per stage."""
    result = await db.execute(
        select(
            Stage.name,
            Stage.order,
            func.count(Opportunity.id).label("deal_count"),
            func.coalesce(func.sum(Opportunity.value), 0).label("total_value"),
            func.coalesce(func.avg(Opportunity.win_probability), 0).label("avg_prob"),
        )
        .outerjoin(Opportunity, Opportunity.stage_id == Stage.id)
        .group_by(Stage.name, Stage.order)
        .order_by(Stage.order)
    )
    rows = result.all()
    return [
        {
            "stage_name": r.name,
            "stage_order": r.order,
            "deal_count": r.deal_count,
            "total_value": float(r.total_value),
            "avg_probability": float(r.avg_prob),
        }
        for r in rows
    ]


@router.get("/forecast")
async def get_forecast(db: AsyncSession = Depends(get_db)):
    """Weighted pipeline forecast by month."""
    await _refresh_materialized_views(db)
    result = await db.execute(text("""
        SELECT close_month, weighted_pipeline, unweighted_pipeline, deal_count, avg_probability
        FROM mv_forecast_data
        ORDER BY close_month
    """))
    return [
        {
            "month": str(r.close_month),
            "weighted_pipeline": float(r.weighted_pipeline),
            "unweighted_pipeline": float(r.unweighted_pipeline),
            "deal_count": r.deal_count,
            "avg_probability": float(r.avg_probability),
        }
        for r in result
    ]


@router.get("/rep-performance")
async def get_rep_performance(db: AsyncSession = Depends(get_db)):
    """Sales rep performance metrics."""
    await _refresh_materialized_views(db)
    result = await db.execute(text("SELECT * FROM mv_rep_performance"))
    return [
        {
            "rep_id": str(r.rep_id),
            "rep_name": r.rep_name,
            "total_deals": r.total_deals,
            "won_deals": r.won_deals,
            "won_revenue": float(r.won_revenue),
            "avg_deal_size": float(r.avg_deal_size),
            "quota": float(r.quota) if r.quota else 0,
        }
        for r in result
    ]


@router.get("/sales-of-the-month")
async def get_sales_of_the_month(db: AsyncSession = Depends(get_db)):
    """Sales of the Month — ranking sales rep berdasarkan win rate & closed deals bulan ini."""
    from datetime import date
    today = date.today()
    month_start = today.replace(day=1)

    # Ambil semua users dengan role sales_rep
    users_result = await db.execute(
        select(User).where(User.role == "sales_rep").order_by(User.name)
    )
    users = users_result.scalars().all()

    # Ambil semua stages
    stages_result = await db.execute(select(Stage))
    stages = stages_result.scalars().all()
    stage_map = {s.id: s for s in stages}

    # Ambil semua opportunities bulan ini
    opps_result = await db.execute(
        select(Opportunity).where(Opportunity.close_date >= month_start)
    )
    all_opps = opps_result.scalars().all()

    # Ambil activities bulan ini (untuk activity score)
    acts_result = await db.execute(
        select(Activity).where(Activity.created_at >= month_start)
    )
    all_acts = acts_result.scalars().all()

    # Hitung metrics per rep
    rep_stats = []
    for user in users:
        user_opps = [o for o in all_opps if o.owner_id == user.id]
        user_acts = [a for a in all_acts if a.created_by == user.id]

        total_deals = len(user_opps)
        won_deals = len([o for o in user_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won])
        lost_deals = len([o for o in user_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_closed and not stage_map[o.stage_id].is_won])
        open_deals = total_deals - won_deals - lost_deals

        won_revenue = sum(o.value for o in user_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won)
        pipeline_value = sum(o.value for o in user_opps if stage_map.get(o.stage_id) and not stage_map[o.stage_id].is_closed)

        # Win rate = won / (won + lost), handle divide by zero
        closed_deals = won_deals + lost_deals
        win_rate = (won_deals / closed_deals * 100) if closed_deals > 0 else 0.0

        # Activity score = jumlah activities bulan ini
        activity_count = len(user_acts)

        # Composite score: win_rate * 40% + won_revenue normalized * 40% + activity_count normalized * 20%
        # Normalisasi dilakukan setelah dapat semua data
        rep_stats.append({
            "rep_id": str(user.id),
            "rep_name": user.name,
            "email": user.email,
            "quota": float(user.quota),
            "total_deals": total_deals,
            "won_deals": won_deals,
            "lost_deals": lost_deals,
            "open_deals": open_deals,
            "won_revenue": float(won_revenue),
            "pipeline_value": float(pipeline_value),
            "win_rate": round(win_rate, 1),
            "activity_count": activity_count,
            "quota_attainment": round((won_revenue / user.quota * 100), 1) if user.quota > 0 else 0.0,
        })

    # Normalisasi untuk composite score
    max_revenue = max((r["won_revenue"] for r in rep_stats), default=1) or 1
    max_activity = max((r["activity_count"] for r in rep_stats), default=1) or 1

    for r in rep_stats:
        revenue_score = (r["won_revenue"] / max_revenue) * 100 if max_revenue > 0 else 0
        activity_score = (r["activity_count"] / max_activity) * 100 if max_activity > 0 else 0
        r["composite_score"] = round(r["win_rate"] * 0.4 + revenue_score * 0.4 + activity_score * 0.2, 1)

    # Sort by composite score descending
    rep_stats.sort(key=lambda x: x["composite_score"], reverse=True)

    # Tambah ranking
    for i, r in enumerate(rep_stats):
        r["rank"] = i + 1

    # Tentukan winner
    winner = rep_stats[0] if rep_stats else None

    return {
        "month": today.strftime("%B %Y"),
        "winner": winner,
        "ranking": rep_stats,
    }


@router.get("/target-tracking")
async def get_target_tracking(db: AsyncSession = Depends(get_db)):
    """Target tracking: company, team, individual targets vs achievement."""
    from datetime import date, timedelta

    # Ambil semua sales reps
    users_result = await db.execute(
        select(User).where(User.role == "sales_rep").order_by(User.name)
    )
    users = users_result.scalars().all()

    # Ambil semua stages
    stages_result = await db.execute(select(Stage))
    stages = stages_result.scalars().all()
    stage_map = {s.id: s for s in stages}

    # Ambil semua opportunities
    opps_result = await db.execute(select(Opportunity))
    all_opps = opps_result.scalars().all()

    # Hitung per-individual
    individuals = []
    for user in users:
        user_opps = [o for o in all_opps if o.owner_id == user.id]
        won_revenue = sum(
            float(o.value) for o in user_opps
            if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won
        )
        pipeline_value = sum(
            float(o.value) for o in user_opps
            if stage_map.get(o.stage_id) and not stage_map[o.stage_id].is_closed
        )
        won_count = len([
            o for o in user_opps
            if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won
        ])
        individuals.append({
            "rep_id": str(user.id),
            "rep_name": user.name,
            "email": user.email,
            "target": float(user.quota),
            "achieved": won_revenue,
            "pipeline": pipeline_value,
            "percentage": round(won_revenue / float(user.quota) * 100, 1) if user.quota > 0 else 0,
            "deal_count": len(user_opps),
            "won_count": won_count,
        })

    # Company totals
    company_target = sum(i["target"] for i in individuals)
    company_achieved = sum(i["achieved"] for i in individuals)
    company_pipeline = sum(i["pipeline"] for i in individuals)

    # Bagi menjadi 2 tim (Team Alpha & Team Beta)
    mid = len(individuals) // 2 if len(individuals) > 1 else len(individuals)
    teams = []
    for team_name, team_members in [
        ("Team Alpha", individuals[:mid]),
        ("Team Beta", individuals[mid:] if mid < len(individuals) else []),
    ]:
        if not team_members:
            continue
        team_target = sum(m["target"] for m in team_members)
        team_achieved = sum(m["achieved"] for m in team_members)
        team_pipeline = sum(m["pipeline"] for m in team_members)
        teams.append({
            "team_name": team_name,
            "member_count": len(team_members),
            "target": team_target,
            "achieved": team_achieved,
            "pipeline": team_pipeline,
            "percentage": round(team_achieved / team_target * 100, 1) if team_target > 0 else 0,
            "members": team_members,
        })

    return {
        "company": {
            "target": company_target,
            "achieved": company_achieved,
            "pipeline": company_pipeline,
            "percentage": round(company_achieved / company_target * 100, 1) if company_target > 0 else 0,
            "rep_count": len(individuals),
        },
        "teams": teams,
        "individuals": individuals,
    }


@router.get("/pipeline-insight")
async def get_pipeline_insight(db: AsyncSession = Depends(get_db)):
    """High-level pipeline insight: stage breakdown, at-risk deals, metrics."""
    from datetime import date, timedelta

    today = date.today()
    thirty_days = today + timedelta(days=30)
    month_end = today.replace(day=28) + timedelta(days=4)

    # Ambil semua stages
    stages_result = await db.execute(select(Stage).order_by(Stage.order))
    stages = stages_result.scalars().all()
    stage_map = {s.id: s for s in stages}

    # Ambil semua opportunities
    opps_result = await db.execute(select(Opportunity))
    all_opps = opps_result.scalars().all()

    # Breakdown per stage
    stage_insights = []
    for stage in stages:
        stage_opps = [o for o in all_opps if o.stage_id == stage.id]
        total_value = sum(float(o.value) for o in stage_opps)
        avg_prob = (
            sum(float(o.win_probability) for o in stage_opps) / len(stage_opps)
            if stage_opps else 0.0
        )

        # At-risk deals: close within 30 days & win_prob < 50%
        at_risk = []
        if not stage.is_closed:
            for o in stage_opps:
                if o.close_date and o.close_date <= thirty_days and float(o.win_probability) < 0.50:
                    at_risk.append({
                        "id": str(o.id),
                        "name": o.name,
                        "value": float(o.value),
                        "win_probability": round(float(o.win_probability) * 100, 1),
                        "close_date": str(o.close_date),
                        "days_to_close": (o.close_date - today).days,
                    })

        stage_insights.append({
            "stage_id": str(stage.id),
            "stage_name": stage.name,
            "stage_order": stage.order,
            "is_closed": stage.is_closed,
            "is_won": stage.is_won,
            "deal_count": len(stage_opps),
            "total_value": total_value,
            "avg_probability": round(avg_prob, 3),
            "weighted_value": round(total_value * avg_prob, 2),
            "at_risk_deals": at_risk,
            "at_risk_count": len(at_risk),
        })

    # Overall metrics
    open_opps = [o for o in all_opps if stage_map.get(o.stage_id) and not stage_map[o.stage_id].is_closed]
    won_opps = [o for o in all_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won]
    lost_opps = [o for o in all_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_closed and not stage_map[o.stage_id].is_won]

    total_pipeline = sum(float(o.value) for o in open_opps)
    total_won = sum(float(o.value) for o in won_opps)
    total_lost = sum(float(o.value) for o in lost_opps)
    weighted_pipeline = sum(float(o.value) * float(o.win_probability) for o in open_opps)

    closed_count = len(won_opps) + len(lost_opps)
    win_conversion = (len(won_opps) / closed_count * 100) if closed_count > 0 else 0
    avg_deal_size = total_pipeline / len(open_opps) if open_opps else 0

    # Deals closing this month
    closing_soon = []
    for o in open_opps:
        if o.close_date and o.close_date <= month_end:
            closing_soon.append({
                "id": str(o.id),
                "name": o.name,
                "value": float(o.value),
                "win_probability": round(float(o.win_probability) * 100, 1),
                "close_date": str(o.close_date),
                "days_to_close": (o.close_date - today).days,
            })
    closing_soon.sort(key=lambda x: x["days_to_close"] if x["days_to_close"] is not None else 999)

    return {
        "summary": {
            "total_pipeline_value": total_pipeline,
            "weighted_pipeline": weighted_pipeline,
            "total_won_revenue": total_won,
            "total_lost_value": total_lost,
            "open_deals": len(open_opps),
            "won_deals": len(won_opps),
            "lost_deals": len(lost_opps),
            "win_conversion_rate": round(win_conversion, 1),
            "avg_deal_size": avg_deal_size,
            "deals_closing_this_month": len(closing_soon),
            "at_risk_count": sum(si["at_risk_count"] for si in stage_insights),
        },
        "stage_insights": stage_insights,
        "closing_soon": closing_soon[:10],
    }


@router.get("/analytics")
async def get_analytics(db: AsyncSession = Depends(get_db)):
    """Comprehensive analytics: revenue trend, conversion, velocity, win/loss, leaderboard, etc."""
    from datetime import date, timedelta
    from collections import defaultdict

    today = date.today()

    # ── Fetch all data ──
    stages_result = await db.execute(select(Stage).order_by(Stage.order))
    stages = stages_result.scalars().all()
    stage_map = {s.id: s for s in stages}

    opps_result = await db.execute(select(Opportunity))
    all_opps = opps_result.scalars().all()

    users_result = await db.execute(select(User).where(User.role == "sales_rep").order_by(User.name))
    users = users_result.scalars().all()

    accounts_result = await db.execute(select(Account))
    accounts = accounts_result.scalars().all()
    account_map = {a.id: a for a in accounts}

    # ── 1. Revenue Trend (monthly won revenue) ──
    revenue_by_month = defaultdict(lambda: {"revenue": 0.0, "deal_count": 0})
    for o in all_opps:
        s = stage_map.get(o.stage_id)
        if s and s.is_won and o.close_date:
            month_key = o.close_date.strftime("%Y-%m")
            revenue_by_month[month_key]["revenue"] += float(o.value)
            revenue_by_month[month_key]["deal_count"] += 1

    revenue_trend = [
        {"month": k, "revenue": v["revenue"], "deal_count": v["deal_count"]}
        for k, v in sorted(revenue_by_month.items())
    ]

    # ── 2. Conversion Funnel ──
    funnel_stages = []
    prev_count = None
    for stage in stages:
        stage_opps = [o for o in all_opps if o.stage_id == stage.id]
        count = len(stage_opps)
        value = sum(float(o.value) for o in stage_opps)
        conversion = (count / prev_count * 100) if prev_count and prev_count > 0 else 100.0
        funnel_stages.append({
            "name": stage.name,
            "order": stage.order,
            "deal_count": count,
            "total_value": value,
            "conversion_rate": round(conversion, 1),
        })
        prev_count = count

    total_entered = sum(f["deal_count"] for f in funnel_stages if f["order"] <= 4)
    total_won_count = len([o for o in all_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won])
    overall_conversion = (total_won_count / total_entered * 100) if total_entered > 0 else 0

    # ── 3. Deal Velocity ──
    closed_opps = [o for o in all_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_closed and o.close_date]
    avg_days_to_close = (
        sum((o.close_date - o.created_at.date()).days for o in closed_opps) / len(closed_opps)
        if closed_opps else 0
    )

    open_opps = [o for o in all_opps if stage_map.get(o.stage_id) and not stage_map[o.stage_id].is_closed]
    avg_open_age = (
        sum((today - o.created_at.date()).days for o in open_opps) / len(open_opps)
        if open_opps else 0
    )

    velocity_by_stage = []
    for stage in stages:
        if stage.is_closed:
            continue
        stage_open = [o for o in open_opps if o.stage_id == stage.id]
        avg_days = (
            sum((today - o.created_at.date()).days for o in stage_open) / len(stage_open)
            if stage_open else 0
        )
        velocity_by_stage.append({
            "stage_name": stage.name,
            "avg_days": round(avg_days, 1),
            "deal_count": len(stage_open),
        })

    # ── 4. Win/Loss Analysis ──
    won_opps = [o for o in all_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won]
    lost_opps = [o for o in all_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_closed and not stage_map[o.stage_id].is_won]

    wl_by_month = defaultdict(lambda: {"won": 0, "lost": 0})
    for o in won_opps:
        if o.close_date:
            wl_by_month[o.close_date.strftime("%Y-%m")]["won"] += 1
    for o in lost_opps:
        if o.close_date:
            wl_by_month[o.close_date.strftime("%Y-%m")]["lost"] += 1

    wl_by_source = defaultdict(lambda: {"won": 0, "lost": 0, "open": 0, "total_value": 0.0})
    for o in all_opps:
        src = o.source or "manual"
        s = stage_map.get(o.stage_id)
        if s and s.is_won:
            wl_by_source[src]["won"] += 1
        elif s and s.is_closed:
            wl_by_source[src]["lost"] += 1
        elif s and not s.is_closed:
            wl_by_source[src]["open"] += 1
        wl_by_source[src]["total_value"] += float(o.value)

    source_list = []
    for src, vals in wl_by_source.items():
        closed_d = vals["won"] + vals["lost"]
        wr = (vals["won"] / closed_d * 100) if closed_d > 0 else 0
        source_list.append({
            "source": src,
            "won": vals["won"],
            "lost": vals["lost"],
            "open": vals["open"],
            "win_rate": round(wr, 1),
            "total_value": vals["total_value"],
        })

    # ── 5. Rep Leaderboard ──
    rep_stats = []
    for user in users:
        user_opps = [o for o in all_opps if o.owner_id == user.id]
        won = [o for o in user_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won]
        lost = [o for o in user_opps if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_closed and not stage_map[o.stage_id].is_won]
        open_d = [o for o in user_opps if stage_map.get(o.stage_id) and not stage_map[o.stage_id].is_closed]
        won_rev = sum(float(o.value) for o in won)
        closed_d = len(won) + len(lost)
        wr = (len(won) / closed_d * 100) if closed_d > 0 else 0
        avg_ds = won_rev / len(won) if won else 0
        qa = (won_rev / float(user.quota) * 100) if user.quota > 0 else 0
        rep_stats.append({
            "rep_id": str(user.id),
            "rep_name": user.name,
            "total_deals": len(user_opps),
            "won_deals": len(won),
            "lost_deals": len(lost),
            "open_deals": len(open_d),
            "won_revenue": won_rev,
            "win_rate": round(wr, 1),
            "avg_deal_size": round(avg_ds, 0),
            "quota_attainment": round(qa, 1),
            "pipeline_value": sum(float(o.value) for o in open_d),
        })

    max_rev = max((r["won_revenue"] for r in rep_stats), default=1) or 1
    for r in rep_stats:
        rev_score = (r["won_revenue"] / max_rev) * 100
        r["score"] = round(r["win_rate"] * 0.3 + r["quota_attainment"] * 0.4 + rev_score * 0.3, 1)
    rep_stats.sort(key=lambda x: x["score"], reverse=True)

    # ── 6. Deal Size Distribution ──
    ranges = [
        ("0 - 50M", 0, 50_000_000),
        ("50 - 100M", 50_000_000, 100_000_000),
        ("100 - 250M", 100_000_000, 250_000_000),
        ("250 - 500M", 250_000_000, 500_000_000),
        ("500M+", 500_000_000, float("inf")),
    ]
    size_dist = []
    for label, lo, hi in ranges:
        bucket = [o for o in all_opps if lo <= float(o.value) < hi]
        size_dist.append({
            "range": label,
            "count": len(bucket),
            "total_value": sum(float(o.value) for o in bucket),
        })

    # ── 7. Source Performance (AI vs Manual) ──
    ai_opps = [o for o in all_opps if o.source == "ai_agent"]
    manual_opps = [o for o in all_opps if o.source != "ai_agent"]

    def source_perf(opps_list):
        won = [o for o in opps_list if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_won]
        closed_d = [o for o in opps_list if stage_map.get(o.stage_id) and stage_map[o.stage_id].is_closed]
        total_val = sum(float(o.value) for o in opps_list)
        wr = (len(won) / len(closed_d) * 100) if closed_d else 0
        avg_val = total_val / len(opps_list) if opps_list else 0
        return {
            "count": len(opps_list),
            "value": total_val,
            "won": len(won),
            "win_rate": round(wr, 1),
            "avg_value": round(avg_val, 0),
        }

    # ── 8. Industry Breakdown ──
    industry_data = defaultdict(lambda: {"deal_count": 0, "total_value": 0.0, "won_value": 0.0})
    for o in all_opps:
        acct = account_map.get(o.account_id)
        industry = acct.industry if acct and acct.industry else "Unknown"
        industry_data[industry]["deal_count"] += 1
        industry_data[industry]["total_value"] += float(o.value)
        s = stage_map.get(o.stage_id)
        if s and s.is_won:
            industry_data[industry]["won_value"] += float(o.value)

    industry_list = [
        {"industry": k, "deal_count": v["deal_count"], "total_value": v["total_value"], "won_value": v["won_value"]}
        for k, v in sorted(industry_data.items(), key=lambda x: x[1]["total_value"], reverse=True)
    ]

    # ── 9. Aging Analysis ──
    age_buckets = [
        ("0-30 days", 0, 30),
        ("31-60 days", 31, 60),
        ("61-90 days", 61, 90),
        ("90+ days", 91, 9999),
    ]
    aging = []
    for label, lo, hi in age_buckets:
        bucket = [o for o in open_opps if lo <= (today - o.created_at.date()).days <= hi]
        aging.append({
            "bucket": label,
            "count": len(bucket),
            "total_value": sum(float(o.value) for o in bucket),
        })

    # ── 10. Pipeline Health Score ──
    health_factors = []
    total_closed = len(won_opps) + len(lost_opps)
    wr_score = (len(won_opps) / total_closed * 100) if total_closed > 0 else 0
    health_factors.append({"label": "Win Rate", "value": f"{wr_score:.0f}%", "status": "good" if wr_score >= 60 else "warning" if wr_score >= 40 else "bad"})

    total_quota = sum(float(u.quota) for u in users)
    pipeline_val = sum(float(o.value) for o in open_opps)
    coverage = (pipeline_val / total_quota * 100) if total_quota > 0 else 0
    health_factors.append({"label": "Pipeline Coverage", "value": f"{coverage:.0f}%", "status": "good" if coverage >= 300 else "warning" if coverage >= 200 else "bad"})

    at_risk = len([o for o in open_opps if o.close_date and o.close_date <= today + timedelta(days=30) and float(o.win_probability) < 0.5])
    health_factors.append({"label": "At-Risk Deals", "value": str(at_risk), "status": "good" if at_risk == 0 else "warning" if at_risk <= 5 else "bad"})

    avg_wp = (sum(float(o.win_probability) for o in open_opps) / len(open_opps)) if open_opps else 0
    health_factors.append({"label": "Avg Win Probability", "value": f"{avg_wp*100:.0f}%", "status": "good" if avg_wp >= 0.5 else "warning" if avg_wp >= 0.3 else "bad"})

    vel_status = "good" if avg_days_to_close <= 60 else "warning" if avg_days_to_close <= 90 else "bad"
    health_factors.append({"label": "Avg Days to Close", "value": f"{avg_days_to_close:.0f}d", "status": vel_status})

    status_map = {"good": 100, "warning": 60, "bad": 20}
    health_score = sum(status_map[f["status"]] for f in health_factors) / len(health_factors) if health_factors else 0

    return {
        "revenue_trend": revenue_trend,
        "conversion_funnel": {
            "stages": funnel_stages,
            "overall_conversion_rate": round(overall_conversion, 1),
        },
        "deal_velocity": {
            "avg_days_to_close": round(avg_days_to_close, 1),
            "avg_open_deal_age": round(avg_open_age, 1),
            "by_stage": velocity_by_stage,
        },
        "win_loss": {
            "total_won": len(won_opps),
            "total_lost": len(lost_opps),
            "win_rate": round((len(won_opps) / total_closed * 100) if total_closed > 0 else 0, 1),
            "won_revenue": sum(float(o.value) for o in won_opps),
            "lost_revenue": sum(float(o.value) for o in lost_opps),
            "by_month": [
                {"month": k, "won": v["won"], "lost": v["lost"]}
                for k, v in sorted(wl_by_month.items())
            ],
            "by_source": source_list,
        },
        "rep_leaderboard": rep_stats,
        "deal_size_distribution": size_dist,
        "source_performance": {
            "ai": source_perf(ai_opps),
            "manual": source_perf(manual_opps),
        },
        "industry_breakdown": industry_list,
        "aging_analysis": aging,
        "pipeline_health": {
            "score": round(health_score, 0),
            "factors": health_factors,
        },
    }
