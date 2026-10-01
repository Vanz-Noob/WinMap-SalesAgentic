"""Tools yang dapat dipanggil oleh AI Agent (function calling via BytePlus ModelArk)."""
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import Opportunity, Account, Stage, User
from app.llm_client import embed_text


async def tool_create_opportunity(db: AsyncSession, name: str, value: float,
                                   account_name: str = None, source: str = "ai_agent"):
    """Buat opportunity baru di database."""
    # Embed opportunity name untuk vector search
    embedding = None
    try:
        embedding = await embed_text(f"{name} {account_name or ''}")
    except Exception:
        pass  # Fail gracefully if embedding API unavailable

    # Cari atau buat account
    account_id = None
    if account_name:
        existing = await db.execute(
            select(Account).where(Account.name.ilike(f"%{account_name}%")).limit(1)
        )
        account = existing.scalars().first()
        if account:
            account_id = account.id
        else:
            account = Account(name=account_name)
            db.add(account)
            await db.flush()
            account_id = account.id

    # Get first stage (Prospecting)
    stage_result = await db.execute(select(Stage).order_by(Stage.order).limit(1))
    stage = stage_result.scalars().first()

    # Auto-assign presales: pilih presales dengan beban opportunity tersedikit
    presales_id = None
    presales_result = await db.execute(
        select(User).where(User.role == "presales").order_by(User.name)
    )
    presales_users = presales_result.scalars().all()
    if presales_users:
        if len(presales_users) == 1:
            presales_id = presales_users[0].id
        else:
            # Cari presales dengan jumlah opportunity paling sedikit
            count_result = await db.execute(
                select(Opportunity.presales_id, func.count(Opportunity.id).label("cnt"))
                .where(Opportunity.presales_id.in_([u.id for u in presales_users]))
                .group_by(Opportunity.presales_id)
            )
            counts = {row.presales_id: row.cnt for row in count_result}
            # Presales yang belum punya opportunity sama sekali = prioritas
            unassigned = [u for u in presales_users if u.id not in counts]
            if unassigned:
                presales_id = unassigned[0].id
            else:
                # Pilih yang count-nya paling sedikit
                presales_id = min(counts, key=counts.get)

    opp = Opportunity(
        name=name,
        value=value,
        source=source,
        account_id=account_id,
        stage_id=stage.id if stage else None,
        presales_id=presales_id,
        embedding=embedding,
    )
    db.add(opp)
    await db.commit()
    await db.refresh(opp)
    return {"id": str(opp.id), "name": opp.name, "value": float(opp.value), "presales_id": str(opp.presales_id) if opp.presales_id else None}


async def tool_search_similar_deals(db: AsyncSession, query: str, limit: int = 5):
    """Cari opportunity mirip menggunakan pgvector cosine similarity."""
    query_embedding = await embed_text(query)
    result = await db.execute(
        select(Opportunity)
        .order_by(Opportunity.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )
    deals = result.scalars().all()
    return [{"id": str(d.id), "name": d.name, "value": float(d.value)} for d in deals]


async def tool_score_lead_bant(lead_info: dict):
    """
    Score lead berdasarkan BANT framework menggunakan Skylark-pro.
    Returns: {budget: 0-1, authority: 0-1, need: 0-1, timeline: 0-1, total: 0-1}
    """
    from app.llm_client import chat_pro

    prompt = f"""
    Analisis lead berikut dengan BANT framework (Budget, Authority, Need, Timeline).
    Berikan skor 0.0-1.0 untuk setiap dimensi, dan total skor.

    Lead info: {json.dumps(lead_info, indent=2)}

    Respond ONLY dalam format JSON:
    {{"budget": 0.0, "authority": 0.0, "need": 0.0, "timeline": 0.0, "total": 0.0, "reasoning": "..."}}
    """
    response = await chat_pro(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"total": 0.0, "error": "Failed to parse LLM response"}


# Tool schema untuk OpenAI function calling format
OPPORTUNITY_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "create_opportunity",
            "description": "Buat record opportunity baru di database",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nama opportunity"},
                    "value": {"type": "number", "description": "Nilai deal"},
                    "account_name": {"type": "string", "description": "Nama perusahaan"},
                    "source": {"type": "string", "description": "Sumber lead"},
                },
                "required": ["name", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "score_lead_bant",
            "description": "Score lead berdasarkan BANT framework",
            "parameters": {
                "type": "object",
                "properties": {
                    "budget": {"type": "string"},
                    "authority": {"type": "string"},
                    "need": {"type": "string"},
                    "timeline": {"type": "string"},
                },
            },
        },
    },
]
