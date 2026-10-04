"""Auth API endpoints: register, login, me, logout."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
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
from app.models import User
from app.schemas.auth import UserLogin, UserOut, UserRegister, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_KWARGS = dict(
    key="access_token",
    httponly=True,
    samesite="lax",
    max_age=settings.JWT_EXPIRE_MINUTES * 60,
    path="/",
)


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserRegister, response: Response, db: Annotated[AsyncSession, Depends(get_db)]):
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

    token = create_access_token({"sub": str(user.id), "role": user.role})
    # Set httpOnly cookie so frontend JS cannot read the token (XSS protection)
    response.set_cookie(secure=not settings.DEBUG, **_COOKIE_KWARGS, value=token)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, response: Response, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda dinonaktifkan. Hubungi administrator.",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    # Set httpOnly cookie so frontend JS cannot read the token (XSS protection)
    response.set_cookie(secure=not settings.DEBUG, **_COOKIE_KWARGS, value=token)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout")
async def logout(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie(key="access_token", path="/")
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    return current_user
