"""Pydantic schemas for Opportunity CRUD."""
import uuid
from datetime import date, datetime
from pydantic import BaseModel


class OpportunityCreate(BaseModel):
    account_id: uuid.UUID | None = None
    name: str
    stage_id: uuid.UUID | None = None
    value: float
    currency: str = "IDR"
    close_date: date | None = None
    owner_id: uuid.UUID | None = None
    presales_id: uuid.UUID | None = None
    source: str | None = None


class OpportunityUpdate(BaseModel):
    name: str | None = None
    stage_id: uuid.UUID | None = None
    value: float | None = None
    close_date: date | None = None
    win_probability: float | None = None
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
