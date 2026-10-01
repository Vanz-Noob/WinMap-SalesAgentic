"""
Pipeline Agent: Evaluasi & rekomendasi stage transition, win probability, next best action.
Menggunakan BytePlus ModelArk Skylark-pro untuk reasoning.
"""
import json
from app.llm_client import chat_pro
from app.models import Opportunity, Stage, Activity, AgentLog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta


PIPELINE_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "move_stage",
            "description": "Rekomendasi pemindahan deal ke stage berikutnya",
            "parameters": {
                "type": "object",
                "properties": {
                    "opp_id": {"type": "string"},
                    "target_stage": {"type": "string"},
                    "reasoning": {"type": "string"},
                },
                "required": ["opp_id", "target_stage"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "next_best_action",
            "description": "Rekomendasi tindakan terbaik untuk deal",
            "parameters": {
                "type": "object",
                "properties": {
                    "opp_id": {"type": "string"},
                    "action": {"type": "string", "description": "call|email|demo|follow_up|proposal"},
                    "description": {"type": "string"},
                },
                "required": ["opp_id", "action"],
            },
        },
    },
]


async def evaluate_deal(opp: Opportunity, activities: list[Activity], stages: list[Stage]) -> dict:
    """
    Evaluasi single deal: apakah siap maju stage? win probability? next action?
    """
    context = {
        "opp_name": opp.name,
        "current_value": float(opp.value),
        "current_stage": next((s.name for s in stages if s.id == opp.stage_id), "Unknown"),
        "win_probability": float(opp.win_probability),
        "close_date": str(opp.close_date) if opp.close_date else None,
        "days_to_close": (opp.close_date - datetime.utcnow().date()).days if opp.close_date else None,
        "activity_count": len(activities),
        "last_activity_days_ago": (
            (datetime.utcnow() - activities[-1].created_at).days if activities else 999
        ),
        "activities_summary": [
            {"type": a.type, "desc": a.description[:100] if a.description else ""}
            for a in activities[-10:]
        ],
    }

    prompt = f"""
    Anda adalah Sales Pipeline AI Agent. Analisis deal berikut dan berikan rekomendasi.

    Deal context: {json.dumps(context, indent=2)}

    Available stages: {[s.name for s in stages]}

    Berikan response dalam JSON:
    {{
        "should_advance": true/false,
        "target_stage": "stage name or null",
        "reasoning": "mengapa",
        "updated_win_probability": 0.0-1.0,
        "next_best_action": {{
            "action": "call|email|demo|follow_up|proposal|send_quote",
            "description": "detail tindakan",
            "priority": "high|medium|low"
        }},
        "risk_flags": ["list of concerns"]
    }}
    """
    response = await chat_pro(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )
    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"error": "parse_failed"}


async def run_pipeline_agent(db: AsyncSession, limit: int = 10) -> list[dict]:
    """
    Scan active opportunities, evaluasi, dan return recommendations.
    Limit default 10 deals per run untuk mencegah timeout.
    """
    opps = (await db.execute(
        select(Opportunity).join(Stage).where(Stage.is_closed.is_(False)).limit(limit)
    )).scalars().all()

    stages = (await db.execute(select(Stage).order_by(Stage.order))).scalars().all()

    results = []
    for opp in opps:
        activities = (await db.execute(
            select(Activity).where(Activity.opp_id == opp.id).order_by(Activity.created_at)
        )).scalars().all()

        evaluation = await evaluate_deal(opp, activities, stages)

        # Update win probability if changed
        updated_prob = evaluation.get("updated_win_probability")
        if updated_prob is not None and isinstance(updated_prob, (int, float)):
            opp.win_probability = max(0.0, min(1.0, float(updated_prob)))

        log = AgentLog(
            agent_type="pipeline",
            action="evaluate_deal",
            input={"opp_id": str(opp.id), "opp_name": opp.name},
            output=evaluation,
            status="success",
        )
        db.add(log)
        results.append({
            "opp_id": str(opp.id),
            "opp_name": opp.name,
            "evaluation": evaluation,
        })

    await db.commit()
    return results
