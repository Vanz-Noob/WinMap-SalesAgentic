"""
Opportunity Agent: Mendeteksi & membuat opportunities dari raw input.
Menggunakan BytePlus ModelArk (Skylark-lite untuk NER, Skylark-pro untuk scoring).
"""
import json
from app.llm_client import chat_lite
from app.agents.tools.opportunity_tools import tool_create_opportunity, tool_score_lead_bant
from app.models import AgentLog
from sqlalchemy.ext.asyncio import AsyncSession


async def extract_entities(raw_input: str) -> dict:
    """
    Ekstrak entitas (company, contact, need, budget) dari raw text.
    Menggunakan Skylark-lite (cepat & murah untuk NER).
    """
    prompt = f"""
    Ekstrak informasi berikut dari teks input. Respond ONLY dalam JSON.

    Teks: "{raw_input}"

    Format: {{
        "company_name": "...",
        "contact_name": "...",
        "contact_email": "...",
        "need": "...",
        "budget_mentioned": "...",
        "timeline": "...",
        "sentiment": "positive|neutral|negative"
    }}
    """
    response = await chat_lite(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"error": "parse_failed", "raw": response.choices[0].message.content}


async def run_opportunity_agent(raw_input: str, db: AsyncSession) -> dict:
    """
    Main workflow Opportunity Agent:
    1. Extract entities (Skylark-lite)
    2. Score BANT (Skylark-pro)
    3. Jika score > threshold -> create opportunity
    4. Log action
    """
    # Step 1: Entity extraction
    entities = await extract_entities(raw_input)

    # Step 2: BANT scoring
    bant_score = await tool_score_lead_bant(entities)

    # Step 3: Decision -- create if score > 0.5
    created_opp = None
    if bant_score.get("total", 0) > 0.5:
        opp_name = f"{entities.get('company_name', 'Unknown')} - {entities.get('need', 'General')}"
        estimated_value = 50000000  # Default IDR 50M, bisa di-enhance
        created_opp = await tool_create_opportunity(
            db=db,
            name=opp_name,
            value=estimated_value,
            account_name=entities.get("company_name"),
            source="ai_agent",
        )

    # Step 4: Log
    log = AgentLog(
        agent_type="opportunity",
        action="run_opportunity_agent",
        input={"raw_input": raw_input},
        output={"entities": entities, "bant_score": bant_score, "created_opp": created_opp},
        token_usage=0,
        status="success",
    )
    db.add(log)
    await db.commit()

    return {
        "entities": entities,
        "bant_score": bant_score,
        "opportunity_created": created_opp is not None,
        "opportunity": created_opp,
    }
