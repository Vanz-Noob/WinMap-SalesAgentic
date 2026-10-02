"""Admin API endpoints: user management with RBAC — superadmin only."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import ALL_ROLES, hash_password, require_superadmin
from app.db.database import get_db
from app.models import User
from app.schemas.auth import AdminCreateUser, AdminUpdateUser, AdminUserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    current_user: Annotated[User, Depends(require_superadmin())],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all registered users. Superadmin only."""
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("/users", response_model=AdminUserOut, status_code=201)
async def create_user(
    data: AdminCreateUser,
    current_user: Annotated[User, Depends(require_superadmin())],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new user. Superadmin only — can assign any role including superadmin."""
    if data.role not in ALL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role tidak valid. Pilih: {', '.join(sorted(ALL_ROLES))}",
        )

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar.",
        )

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        quota=data.quota,
        is_active=data.is_active,
        is_superuser=data.is_superuser or data.role == "superadmin",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: UUID,
    data: AdminUpdateUser,
    current_user: Annotated[User, Depends(require_superadmin())],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a user — change role, activate/deactivate, reset password, etc. Superadmin only."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")

    # Prevent superadmin from deactivating/deleting themselves
    if str(user.id) == str(current_user.id):
        if data.is_active is False or data.is_superuser is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menonaktifkan atau menurunkan diri sendiri.",
            )

    if data.role is not None:
        if data.role not in ALL_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Role tidak valid. Pilih: {', '.join(sorted(ALL_ROLES))}",
            )
        user.role = data.role
        # Auto-set is_superuser when role is superadmin
        if data.role == "superadmin":
            user.is_superuser = True

    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        # Check email uniqueness
        existing = await db.execute(select(User).where(User.email == data.email, User.id != user_id))
        if existing.scalars().first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email sudah digunakan.")
        user.email = data.email
    if data.quota is not None:
        user.quota = data.quota
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_superuser is not None:
        user.is_superuser = data.is_superuser
    if data.password is not None:
        user.password_hash = hash_password(data.password)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(require_superadmin())],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a user. Superadmin only. Cannot delete self."""
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak dapat menghapus akun sendiri.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")

    await db.delete(user)
    await db.commit()


@router.get("/roles", response_model=list[str])
async def list_roles(
    current_user: Annotated[User, Depends(require_superadmin())],
):
    """List all valid roles in the system. Superadmin only."""
    return sorted(ALL_ROLES)
