"""Authentication utilities: JWT token, password hashing, current user dependency, RBAC."""
from datetime import datetime, timedelta, timezone
from typing import Annotated, Callable, Iterable

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.models import User

# auto_error=False so cookie-based auth can fall through gracefully
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# All valid roles in the system
ALL_ROLES = {"sales_rep", "presales", "sales_manager", "superadmin"}

# Roles that can be assigned during self-registration (NOT superadmin)
PUBLIC_REGISTER_ROLES = {"sales_rep", "presales", "sales_manager"}


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau kedaluwarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Try Authorization header first, then fall back to httpOnly cookie
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise credentials_exc
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise credentials_exc
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Ensure the user account is active (not deactivated by superadmin)."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda dinonaktifkan. Hubungi administrator.",
        )
    return current_user


def require_roles(*allowed_roles: str) -> Callable:
    """Dependency factory: require the authenticated user to have one of the allowed roles.
    Superadmin always passes regardless of allowed_roles."""
    async def _check(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        if current_user.is_superuser:
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Role '{current_user.role}' tidak memiliki izin ini.",
            )
        return current_user
    return _check


def require_superadmin() -> Callable:
    """Dependency: require superadmin role."""
    async def _check(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        if not current_user.is_superuser and current_user.role != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak. Hanya superadmin.",
            )
        return current_user
    return _check
