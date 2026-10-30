"""Authentication utilities: JWT token, password hashing, current user dependency, RBAC."""
from datetime import datetime, timedelta, timezone
from typing import Annotated, Callable, Iterable

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.logging_config import security_logger
from app.models import Opportunity, User

# auto_error=False so cookie-based auth can fall through gracefully
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# All valid roles in the system
ALL_ROLES = {"sales_rep", "presales", "sales_manager", "superadmin"}

# Roles that can be assigned during self-registration (NOT superadmin)
PUBLIC_REGISTER_ROLES = {"sales_rep", "presales", "sales_manager"}


# bcrypt hanya meng-hash 72 byte pertama (bcrypt 4.x silent-truncate;
# bcrypt >=5.0 raise ValueError). Potong manual agar kompatibel dengan
# hash lama dan tidak 500 untuk password panjang.
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:BCRYPT_MAX_BYTES]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:BCRYPT_MAX_BYTES], hashed.encode("utf-8"))
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
    client_ip = getattr(request.client, "host", None)

    def _unauthorized(reason: str):
        security_logger.warning(
            "auth_401 reason=%s ip=%s", reason, client_ip
        )
        return credentials_exc

    # Try Authorization header first, then fall back to httpOnly cookie
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise _unauthorized("missing_token")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise _unauthorized("missing_sub")
    except JWTError:
        raise _unauthorized("invalid_token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise _unauthorized("user_not_found")
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Ensure the user account is active (not deactivated by superadmin)."""
    if not current_user.is_active:
        security_logger.warning(
            "auth_403 reason=inactive_account user_id=%s role=%s",
            current_user.id,
            current_user.role,
        )
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
            security_logger.warning(
                "auth_403 reason=role_denied user_id=%s role=%s required=%s",
                current_user.id,
                current_user.role,
                sorted(allowed_roles),
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Role '{current_user.role}' tidak memiliki izin ini.",
            )
        return current_user
    return _check


def can_view_all_data(user: User | None) -> bool:
    """True jika user berhak melihat data lintas owner (superadmin/sales_manager).

    user=None berarti konteks sistem (background job Celery) yang dijalankan
    server-side tepercaya → global view.
    """
    if user is None:
        return True
    return user.is_superuser or user.role in ("superadmin", "sales_manager")


def opportunity_scope(user: User | None):
    """Filter SQLAlchemy untuk scoping Opportunity berdasarkan role user.

    - superadmin/sales_manager (atau None=konteks sistem): None (company-wide)
    - presales: opportunity yang di-own ATAU di-assign sebagai presales
    - lainnya (sales_rep): hanya opportunity yang di-own
    """
    if can_view_all_data(user):
        return None
    if user.role == "presales":
        return or_(Opportunity.owner_id == user.id, Opportunity.presales_id == user.id)
    return Opportunity.owner_id == user.id


def require_superadmin() -> Callable:
    """Dependency: require superadmin role."""
    async def _check(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        if not current_user.is_superuser and current_user.role != "superadmin":
            security_logger.warning(
                "auth_403 reason=superadmin_required user_id=%s role=%s",
                current_user.id,
                current_user.role,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak. Hanya superadmin.",
            )
        return current_user
    return _check
