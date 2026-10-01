"""Celery app for background agent execution."""
import asyncio
import logging
from celery import Celery
from app.config import settings

logger = logging.getLogger(__name__)

celery_app = Celery("rsa_workers", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Jakarta",
    enable_utc=True,
    beat_schedule={
        "pipeline-scan-hourly": {
            "task": "tasks.scan_pipeline",
            "schedule": 3600,
        },
        "daily-briefing": {
            "task": "tasks.daily_briefing",
            "schedule": 86400,
        },
    },
)


def _run_async(coro_func):
    """Run async coroutine in a fresh event loop with NullPool to avoid connection leaks."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy.pool import NullPool

    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _run():
        async with session_factory() as db:
            return await coro_func(db)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_run())
        loop.close()
        return result
    except Exception as e:
        logger.error(f"Celery task error: {e}")
        raise
    finally:
        # Ensure engine is disposed
        asyncio.get_event_loop().run_until_complete(engine.dispose()) if not loop.is_closed() else None


@celery_app.task(name="tasks.scan_pipeline")
def scan_pipeline():
    """Scheduled: scan pipeline setiap jam."""
    from app.agents.pipeline_agent import run_pipeline_agent
    return _run_async(run_pipeline_agent)


@celery_app.task(name="tasks.daily_briefing")
def daily_briefing():
    """Scheduled: daily insight briefing."""
    from app.agents.insight_agent import generate_daily_briefing
    return _run_async(generate_daily_briefing)
