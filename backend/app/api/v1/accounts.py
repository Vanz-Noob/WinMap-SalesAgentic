"""CRUD API for Accounts, Contacts, and Users."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Account, Contact, User
from app.schemas.common import AccountCreate, AccountResponse, ContactCreate, ContactResponse, UserResponse
import uuid

router = APIRouter(prefix="/accounts", tags=["accounts"])


# ── Users ──────────────────────────────────
@router.get("/users/list", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    """List semua users (untuk filter dropdown)."""
    result = await db.execute(select(User).order_by(User.name))
    return result.scalars().all()


@router.get("", response_model=list[AccountResponse])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).order_by(Account.name))
    return result.scalars().all()


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(data: AccountCreate, db: AsyncSession = Depends(get_db)):
    account = Account(**data.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}/contacts", response_model=list[ContactResponse])
async def list_contacts(account_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contact).where(Contact.account_id == account_id).order_by(Contact.name)
    )
    return result.scalars().all()


@router.post("/contacts", response_model=ContactResponse, status_code=201)
async def create_contact(data: ContactCreate, db: AsyncSession = Depends(get_db)):
    contact = Contact(**data.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact
