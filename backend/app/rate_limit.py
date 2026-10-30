"""Rate limiting via Redis fixed-window counter.

- Fail-open: jika Redis tak tersedia, request diteruskan (availability > rate limit).
- Scope "ip": endpoint publik (login/register) — key per-IP.
- Scope "user": endpoint mahal (agents LLM) — key per-user.
- X-Forwarded-For dipakai di belakang nginx; fallback request.client.host.
"""
import time

from fastapi import Depends, HTTPException, Request, status
from redis import asyncio as aioredis

from app.auth import get_current_active_user
from app.config import settings
from app.logging_config import security_logger
from app.models import User

_client: aioredis.Redis | None = None
_client_tried = False


def _redis() -> aioredis.Redis | None:
    global _client, _client_tried
    if not _client_tried:
        _client_tried = True
        try:
            _client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
        except Exception:
            _client = None
    return _client


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return getattr(request.client, "host", "unknown")


async def check_rate_limit(
    request: Request, scope: str, limit: int, window: int, key_id: str = ""
) -> None:
    """Increment counter; raise 429 jika melewati limit dalam window detik."""
    r = _redis()
    if r is None:
        return
    key = f"rl:{scope}:{key_id or _client_ip(request)}:{int(time.time() // window)}"
    try:
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window)
    except Exception:
        # Redis down / timeout — fail-open
        return
    if count > limit:
        security_logger.warning(
            "rate_limited scope=%s ip=%s key_id=%s count=%s limit=%s",
            scope,
            _client_ip(request),
            key_id,
            count,
            limit,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Terlalu banyak permintaan. Coba lagi nanti.",
            headers={"Retry-After": str(window)},
        )


def rate_limit_ip(scope: str, limit: int, window: int):
    """Dependency factory: rate limit per-IP (endpoint publik auth)."""

    async def _dep(request: Request):
        await check_rate_limit(request, scope, limit, window)

    return _dep


def rate_limit_user(scope: str, limit: int, window: int):
    """Dependency factory: rate limit per-user (endpoint mahal, butuh auth)."""

    async def _dep(request: Request, current_user: User = Depends(get_current_active_user)):
        await check_rate_limit(request, scope, limit, window, key_id=str(current_user.id))

    return _dep
