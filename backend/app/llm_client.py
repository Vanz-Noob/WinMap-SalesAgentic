"""BytePlus ModelArk LLM & Embedding client (OpenAI-compatible)."""
import logging
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger(__name__)

# Async client untuk chat completions & tool calling
llm_client = AsyncOpenAI(
    base_url=settings.ARK_BASE_URL,
    api_key=settings.ARK_API_KEY,
)


async def chat_pro(messages: list, tools: list | None = None, temperature: float = 0.7):
    """Skylark-pro untuk reasoning kompleks (stage transition, BANT scoring)."""
    try:
        return await llm_client.chat.completions.create(
            model=settings.LLM_MODEL_PRO,
            messages=messages,
            tools=tools,
            temperature=temperature,
        )
    except Exception as e:
        logger.error(f"chat_pro error: {e}")
        raise


async def chat_lite(messages: list, temperature: float = 0.3):
    """Skylark-lite untuk tugas sederhana (NER, classification, summary)."""
    try:
        return await llm_client.chat.completions.create(
            model=settings.LLM_MODEL_LITE,
            messages=messages,
            temperature=temperature,
        )
    except Exception as e:
        logger.error(f"chat_lite error: {e}")
        raise


async def embed_text(text: str) -> list[float]:
    """Skylark embedding untuk RAG / similarity search."""
    try:
        response = await llm_client.embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"embed_text error: {e}")
        raise
