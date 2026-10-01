"""Auth schemas for register, login, token, and user response."""
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
    created_at: datetime

    class Config:
        from_attributes = True


TokenResponse.model_rebuild()
