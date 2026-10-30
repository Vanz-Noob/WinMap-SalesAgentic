"""BytePlus ModelArk LLM & Embedding client (OpenAI-compatible)."""
import logging
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger(__name__)

# Lazy client: openai>=3 raise saat api_key kosong — jangan crash saat import;
# error jelas hanya saat fitur LLM dipakai tanpa ARK_API_KEY.
llm_client: AsyncOpenAI | None = (
    AsyncOpenAI(
        base_url=settings.ARK_BASE_URL,
        api_key=settings.ARK_API_KEY,
    )
    if settings.ARK_API_KEY
    else None
)


def _client() -> AsyncOpenAI:
    if llm_client is None:
        raise RuntimeError("ARK_API_KEY belum diset — fitur LLM tidak tersedia.")
    return llm_client


async def chat_pro(messages: list, tools: list | None = None, temperature: float = 0.7):
    """Skylark-pro untuk reasoning kompleks (stage transition, BANT scoring)."""
    try:
        return await _client().chat.completions.create(
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
        return await _client().chat.completions.create(
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
        response = await _client().embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"embed_text error: {e}")
        raise
