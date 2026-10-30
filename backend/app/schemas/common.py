"""Pydantic schemas for stages, activities, tasks, accounts, contacts."""
import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field

MAX_TEXT_LEN = 2000  # Batas deskripsi/teks panjang — membatasi permukaan indirect prompt injection ke agent.


# ---- Stage ----
class StageResponse(BaseModel):
    id: uuid.UUID
    name: str
    order: int
    probability: float
    is_closed: bool
    is_won: bool
    class Config:
        from_attributes = True


# ---- Activity ----
class ActivityCreate(BaseModel):
    opp_id: uuid.UUID
    type: str = Field(min_length=1, max_length=50)
    description: str | None = Field(None, max_length=MAX_TEXT_LEN)
    created_by: uuid.UUID | None = None

class ActivityResponse(BaseModel):
    id: uuid.UUID
    opp_id: uuid.UUID
    type: str
    description: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    class Config:
        from_attributes = True


# ---- Task ----
class TaskCreate(BaseModel):
    opp_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    due_date: date | None = None
    assigned_to: uuid.UUID | None = None

class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    due_date: date | None = None
    status: str | None = Field(None, min_length=1, max_length=20)

class TaskResponse(BaseModel):
    id: uuid.UUID
    opp_id: uuid.UUID
    title: str
    due_date: date | None
    status: str
    assigned_to: uuid.UUID | None
    created_at: datetime
    class Config:
        from_attributes = True


# ---- Account ----
class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    industry: str | None = Field(None, max_length=100)
    website: str | None = Field(None, max_length=255)
    size: str | None = Field(None, max_length=50)
    region: str | None = Field(None, max_length=100)

class AccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    industry: str | None
    website: str | None
    size: str | None
    region: str | None
    created_at: datetime
    class Config:
        from_attributes = True


# ---- Contact ----
class ContactCreate(BaseModel):
    account_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=50)
    role: str | None = Field(None, max_length=100)

class ContactResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID | None
    name: str
    email: str | None
    phone: str | None
    role: str | None
    created_at: datetime
    class Config:
        from_attributes = True


# ---- User ----
class UserCreate(BaseModel):
    name: str
    email: str
    role: str = "sales_rep"
    quota: float = 0

class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    quota: float
    created_at: datetime
    class Config:
        from_attributes = True


# ---- Agent Log ----
class AgentLogResponse(BaseModel):
    id: uuid.UUID
    agent_type: str
    action: str
    input: dict | None
    output: dict | None
    token_usage: int
    status: str
    timestamp: datetime
    class Config:
        from_attributes = True
