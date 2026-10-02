"""Auth schemas for register, login, token, user response, and admin user management."""
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "sales_rep"  # sales_rep, presales, sales_manager


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    quota: float
    is_active: bool = True
    is_superuser: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# ── Admin User Management Schemas ──

class AdminCreateUser(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # sales_rep, presales, sales_manager, superadmin
    quota: float = 0
    is_active: bool = True
    is_superuser: bool = False


class AdminUpdateUser(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    quota: float | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None
    password: str | None = None  # optional password reset


class AdminUserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    quota: float
    is_active: bool
    is_superuser: bool
    created_at: datetime

    class Config:
        from_attributes = True


TokenResponse.model_rebuild()
