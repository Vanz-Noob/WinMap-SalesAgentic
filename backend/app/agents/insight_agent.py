"""
Insight Agent: Generate narasi insight, forecast, dan deteksi anomali.
Menggunakan BytePlus ModelArk Skylark-pro.
"""
import json
from app.llm_client import chat_pro
from app.models import Opportunity, Stage, AgentLog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime


async def generate_daily_briefing(db: AsyncSession) -> dict:
    """
    Generate daily briefing: summary pipeline, insight, dan alert.
    """
    # Aggregate metrics
    total_pipeline = (await db.execute(
        select(func.sum(Opportunity.value * Opportunity.win_probability))
        .join(Stage).where(Stage.is_closed.is_(False))
    )).scalar() or 0

    total_deals = (await db.execute(
        select(func.count(Opportunity.id)).join(Stage).where(Stage.is_closed.is_(False))
    )).scalar() or 0

    avg_prob = (await db.execute(
        select(func.avg(Opportunity.win_probability))
        .join(Stage).where(Stage.is_closed.is_(False))
    )).scalar() or 0

    metrics = {
        "total_weighted_pipeline": float(total_pipeline),
        "total_open_deals": total_deals,
        "avg_win_probability": float(avg_prob),
        "date": datetime.utcnow().isoformat(),
    }

    # Generate natural language insight via Skylark-pro
    prompt = f"""
    Anda adalah Sales Insight AI. Buat daily briefing singkat berdasarkan data pipeline berikut.
    Sertakan: summary utama, insight menarik, dan 2-3 alert/action items.

    Metrics: {json.dumps(metrics, indent=2)}

    Format response sebagai JSON:
    {{
        "summary": "ringkasan 2-3 kalimat",
        "insights": ["insight 1", "insight 2"],
        "alerts": ["alert 1", "alert 2"],
        "recommendation": "rekomendasi utama"
    }}
    """
    response = await chat_pro(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )
    try:
        briefing = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        briefing = {"summary": response.choices[0].message.content}

    log = AgentLog(
        agent_type="insight",
        action="daily_briefing",
        input=metrics,
        output=briefing,
        status="success",
    )
    db.add(log)
    await db.commit()

    return {"metrics": metrics, "briefing": briefing}
