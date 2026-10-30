"""Pydantic schemas for Opportunity CRUD."""
import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field


class OpportunityCreate(BaseModel):
    account_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    stage_id: uuid.UUID | None = None
    value: float = Field(ge=0)
    currency: str = Field("IDR", min_length=1, max_length=3)
    close_date: date | None = None
    owner_id: uuid.UUID | None = None
    presales_id: uuid.UUID | None = None
    source: str | None = Field(None, max_length=50)


class OpportunityUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    stage_id: uuid.UUID | None = None
    value: float | None = Field(None, ge=0)
    close_date: date | None = None
    # ge/le di schema menjamin 0-1 di SEMUA path (termasuk PATCH yang
    # menyertakan stage_id sekaligus) — menutup clamp bypass.
    win_probability: float | None = Field(None, ge=0.0, le=1.0)
    owner_id: uuid.UUID | None = None
    presales_id: uuid.UUID | None = None


class OpportunityResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID | None
    name: str
    stage_id: uuid.UUID | None
    value: float
    currency: str
    close_date: date | None
    win_probability: float
    owner_id: uuid.UUID | None
    presales_id: uuid.UUID | None = None
    presales_name: str | None = None
    source: str | None
    ai_metadata: dict | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
