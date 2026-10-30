"""
Export Agent: Export pipeline / sales / presales data to CSV with AI-generated summary.
Uses BytePlus ModelArk Skylark-pro for generating export insights.
"""
import csv
import io
import json
import uuid
from datetime import datetime, date
from app.llm_client import chat_pro
from app.auth import can_view_all_data
from app.models import Opportunity, Stage, User, Account, PresalesKpi, AgentLog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import aliased
from typing import Literal


async def _export_pipeline(
    db: AsyncSession,
    stage_filter: str | None = None,
    owner_id: str | None = None,
    closed_only: bool = False,
) -> list[dict]:
    """Export pipeline (opportunities) data. owner_id dipaksa oleh run_export_agent sesuai role."""
    PresalesUser = aliased(User)
    stmt = (
        select(Opportunity, Stage.name.label("stage_name"), User.name.label("owner_name"), Account.name.label("account_name"), PresalesUser.name.label("presales_name"))
        .outerjoin(Stage, Opportunity.stage_id == Stage.id)
        .outerjoin(User, Opportunity.owner_id == User.id)
        .outerjoin(Account, Opportunity.account_id == Account.id)
        .outerjoin(PresalesUser, Opportunity.presales_id == PresalesUser.id)
    )

    conditions = []
    if stage_filter and stage_filter != "all":
        if stage_filter == "open":
            conditions.append(Stage.is_closed.is_(False))
        elif stage_filter == "closed_won":
            conditions.append(Stage.is_won.is_(True))
        elif stage_filter == "closed_lost":
            conditions.append(Stage.is_closed.is_(True))
            conditions.append(Stage.is_won.is_(False))
        else:
            conditions.append(Stage.name == stage_filter)
    elif closed_only:
        conditions.append(Stage.is_closed.is_(True))

    if owner_id:
        conditions.append(Opportunity.owner_id == owner_id)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(Opportunity.created_at.desc())
    result = await db.execute(stmt)
    rows = result.all()

    data = []
    for opp, stage_name, owner_name, account_name, presales_name in rows:
        data.append({
            "id": str(opp.id),
            "opportunity_name": opp.name,
            "account": account_name or "",
            "stage": stage_name or "",
            "value": float(opp.value) if opp.value else 0,
            "currency": opp.currency or "IDR",
            "win_probability": float(opp.win_probability) if opp.win_probability else 0,
            "close_date": str(opp.close_date) if opp.close_date else "",
            "owner": owner_name or "",
            "presales": presales_name or "",
            "source": opp.source or "",
            "created_at": opp.created_at.isoformat() if opp.created_at else "",
        })

    return data


async def _export_presales_kpi(
    db: AsyncSession,
    category: str | None = None,
    quarter: str | None = None,
    year: int | None = None,
    user_id=None,
) -> list[dict]:
    """Export presales KPI data. user_id dipaksa oleh run_export_agent sesuai role."""
    stmt = (
        select(PresalesKpi, User.name.label("user_name"))
        .outerjoin(User, PresalesKpi.user_id == User.id)
    )

    conditions = []
    if user_id:
        conditions.append(PresalesKpi.user_id == user_id)
    if category and category != "all":
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

    data = []
    for kpi, user_name in rows:
        progress = 0.0
        if kpi.target and float(kpi.target) > 0:
            progress = round((float(kpi.actual) / float(kpi.target)) * 100, 1)
        data.append({
            "id": str(kpi.id),
            "category": kpi.category,
            "item_name": kpi.item_name,
            "description": kpi.description or "",
            "target": float(kpi.target) if kpi.target else 0,
            "actual": float(kpi.actual) if kpi.actual else 0,
            "unit": kpi.unit,
            "progress_pct": min(progress, 100.0),
            "quarter": kpi.quarter,
            "year": kpi.year,
            "status": kpi.status,
            "assignee": user_name or "",
            "notes": kpi.notes or "",
            "created_at": kpi.created_at.isoformat() if kpi.created_at else "",
        })

    return data


_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(value):
    """Netralkan spreadsheet formula injection: cell string yang diawali
    = + - @ tab/cr di-prefix kutip tunggal (OWASP CSV injection guidance)."""
    if isinstance(value, str) and value[:1] in _CSV_FORMULA_PREFIXES:
        return "'" + value
    return value


def _to_csv(data: list[dict]) -> str:
    """Convert list of dicts to CSV string (formula-injection safe)."""
    if not data:
        return "No data found"
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows({k: _csv_safe(v) for k, v in row.items()} for row in data)
    return output.getvalue()


async def _generate_export_summary(
    data_type: str,
    data: list[dict],
    filters: dict,
) -> dict:
    """Use LLM to generate a summary of the exported data."""
    if not data:
        return {
            "summary": "No data found for the selected filters.",
            "key_metrics": {},
            "recommendations": [],
        }

    # Build stats summary for the prompt
    if data_type == "pipeline":
        total_value = sum(d.get("value", 0) for d in data)
        stages = {}
        for d in data:
            s = d.get("stage", "Unknown")
            stages[s] = stages.get(s, 0) + 1
        avg_prob = sum(d.get("win_probability", 0) for d in data) / len(data) if data else 0
        stats = {
            "total_deals": len(data),
            "total_value": total_value,
            "avg_win_probability": round(avg_prob, 3),
            "stages_breakdown": stages,
            "filters_applied": filters,
        }
    else:
        categories = {}
        statuses = {}
        for d in data:
            c = d.get("category", "Unknown")
            categories[c] = categories.get(c, 0) + 1
            s = d.get("status", "Unknown")
            statuses[s] = statuses.get(s, 0) + 1
        avg_progress = sum(d.get("progress_pct", 0) for d in data) / len(data) if data else 0
        stats = {
            "total_kpis": len(data),
            "avg_progress": round(avg_progress, 1),
            "categories_breakdown": categories,
            "status_breakdown": statuses,
            "filters_applied": filters,
        }

    prompt = f"""
    Anda adalah Sales Export AI Agent. Buat ringkasan dari data yang di-export.

    Data type: {data_type}
    Statistics: {json.dumps(stats, indent=2)}

    Buat response JSON:
    {{
        "summary": "ringkasan 2-3 kalimat tentang data yang di-export",
        "key_metrics": {{
            "metric_name": "value description"
        }},
        "recommendations": ["rekomendasi 1", "rekomendasi 2", "rekomendasi 3"]
    }}
    """
    try:
        response = await chat_pro(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, Exception):
        return {
            "summary": f"Exported {len(data)} {data_type} records with filters: {json.dumps(filters)}",
            "key_metrics": stats,
            "recommendations": ["Review exported data for details"],
        }


async def run_export_agent(
    db: AsyncSession,
    current_user,
    data_type: Literal["pipeline", "presales"] = "pipeline",
    stage_filter: str | None = None,
    owner_id: uuid.UUID | None = None,
    category: str | None = None,
    quarter: str | None = None,
    year: int | None = None,
) -> dict:
    """
    Export Agent: Export data to CSV + AI-generated summary.

    data_type:
      - "pipeline": Export opportunities (sales pipeline)
      - "presales": Export presales KPI tracking data

    Filters for pipeline:
      - stage_filter: "all", "open", "closed_won", "closed_lost", or specific stage name
      - owner_id: filter by sales rep (hanya superadmin/sales_manager boleh specify;
        role lain dipaksa ke data milik sendiri)

    Filters for presales:
      - category: "all" or specific category key
      - quarter: e.g. "Q3"
      - year: e.g. 2026
    """
    # Owner-scoping: non-superadmin/sales_manager selalu terbatas ke data sendiri,
    # owner_id dari client diabaikan.
    forced_owner_id = None if can_view_all_data(current_user) else current_user.id
    if forced_owner_id is not None:
        owner_id = forced_owner_id

    filters = {"data_type": data_type}

    if data_type == "pipeline":
        if stage_filter:
            filters["stage"] = stage_filter
        if owner_id:
            filters["owner_id"] = str(owner_id)
        data = await _export_pipeline(db, stage_filter=stage_filter, owner_id=owner_id)
        csv_content = _to_csv(data)
        ai_summary = await _generate_export_summary("pipeline", data, filters)
    else:
        if category:
            filters["category"] = category
        if quarter:
            filters["quarter"] = quarter
        if year:
            filters["year"] = year
        kpi_user_id = None if can_view_all_data(current_user) else current_user.id
        data = await _export_presales_kpi(
            db, category=category, quarter=quarter, year=year, user_id=kpi_user_id
        )
        csv_content = _to_csv(data)
        ai_summary = await _generate_export_summary("presales", data, filters)

    # Log
    log = AgentLog(
        agent_type="export",
        action=f"export_{data_type}",
        input=filters,
        output={
            "record_count": len(data),
            "ai_summary": ai_summary,
        },
        token_usage=0,
        status="success",
    )
    db.add(log)
    await db.commit()

    return {
        "data_type": data_type,
        "filters": filters,
        "record_count": len(data),
        "columns": list(data[0].keys()) if data else [],
        "data": data,
        "csv_content": csv_content,
        "ai_summary": ai_summary,
        "exported_at": datetime.utcnow().isoformat(),
    }
