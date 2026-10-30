"""Auth API endpoints: register, login, me, logout."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    ALL_ROLES,
    PUBLIC_REGISTER_ROLES,
    create_access_token,
    get_current_active_user,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import settings
from app.db.database import get_db
from app.logging_config import security_logger
from app.models import User
from app.rate_limit import rate_limit_ip
from app.schemas.auth import UserLogin, UserOut, UserRegister, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_KWARGS = dict(
    key="access_token",
    httponly=True,
    samesite="lax",
    max_age=settings.JWT_EXPIRE_MINUTES * 60,
    path="/",
)

# Hash dummy (bcrypt cost 12) — dijalankan saat email tak terdaftar agar
# waktu respons login sama, mencegah enumerasi email via timing.
_DUMMY_BCRYPT_HASH = "$2b$12$H9YxBDJF9aZvu.7ebkdzA.1KWhMVS1GNl8WQ3Y4J4WCYbOa8bUOZi"


def _is_https(request: Request) -> bool:
    """Detect HTTPS from X-Forwarded-Proto header (set by CloudFlare/ALB/nginx)."""
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    return forwarded_proto == "https" or request.url.scheme == "https"


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: UserRegister,
    response: Response,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rl: Annotated[None, Depends(rate_limit_ip("auth_register", limit=5, window=300))],
):
    """Self-registration — only allows non-superadmin roles (sales_rep, presales, sales_manager).
    Superadmin accounts can only be created via the admin API."""
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar. Silakan login.",
        )

    if data.role not in PUBLIC_REGISTER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role tidak valid untuk registrasi mandiri. Pilih: {', '.join(sorted(PUBLIC_REGISTER_ROLES))}",
        )

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    security_logger.info(
        "register_success user_id=%s email=%s role=%s ip=%s",
        user.id,
        user.email,
        user.role,
        getattr(request.client, "host", None),
    )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    # Set httpOnly cookie so frontend JS cannot read the token (XSS protection)
    # secure=True only when behind HTTPS (CloudFlare tunnel), not bare HTTP
    response.set_cookie(secure=_is_https(request), **_COOKIE_KWARGS, value=token)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    response: Response,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rl: Annotated[None, Depends(rate_limit_ip("auth_login", limit=10, window=60))],
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()

    if not user:
        # Anti user-enumeration: burn waktu bcrypt yang sama seperti verifikasi asli.
        verify_password(data.password, _DUMMY_BCRYPT_HASH)
        security_logger.warning(
            "login_failed reason=invalid_credentials ip=%s email=%s",
            getattr(request.client, "host", None),
            data.email,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah.",
        )

    if not verify_password(data.password, user.password_hash):
        security_logger.warning(
            "login_failed reason=invalid_credentials ip=%s email=%s",
            getattr(request.client, "host", None),
            data.email,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah.",
        )

    if not user.is_active:
        security_logger.warning(
            "login_failed reason=inactive_account ip=%s user_id=%s email=%s",
            getattr(request.client, "host", None),
            user.id,
            data.email,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda dinonaktifkan. Hubungi administrator.",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    # Set httpOnly cookie so frontend JS cannot read the token (XSS protection)
    # secure=True only when behind HTTPS (CloudFlare tunnel), not bare HTTP
    response.set_cookie(secure=_is_https(request), **_COOKIE_KWARGS, value=token)
    security_logger.info(
        "login_success user_id=%s email=%s role=%s ip=%s",
        user.id,
        user.email,
        user.role,
        getattr(request.client, "host", None),
    )
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout")
async def logout(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie(key="access_token", path="/")
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    return current_user
