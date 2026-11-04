"""Who may use the app.

Open mode: everyone. Closed mode: staff (host and above), Rusada students on the
@username list, and people with an active subscription (paid by card transfer,
confirmed by an admin). Everyone else sees only the subscription page.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Member, Setting, Subscription, User, utcnow
from ..schemas import Camel

KEY = "access"
STAFF = ("host", "admin", "superadmin")


class AccessSettings(Camel):
    mode: Literal["open", "closed"] = "open"
    price_uzs: int = Field(default=100_000, ge=0, le=100_000_000)
    days: int = Field(default=30, ge=1, le=366)
    card_number: str = Field(default="", max_length=40)
    card_holder: str = Field(default="", max_length=80)
    note: str = Field(default="", max_length=500)
    #: «N+ savol» on the subscription page shows at least this (0 = only the real count)
    questions_claim: int = Field(default=3000, ge=0, le=1_000_000)
    #: @username of the person students write to (without @)
    support_username: str = Field(default="", max_length=64)


async def get_access_settings(db: AsyncSession) -> AccessSettings:
    row = await db.get(Setting, KEY)
    return AccessSettings.model_validate(row.value) if row else AccessSettings()


async def save_access_settings(db: AsyncSession, value: AccessSettings) -> AccessSettings:
    row = await db.get(Setting, KEY)
    data = value.model_dump()
    if row:
        row.value = data
    else:
        db.add(Setting(key=KEY, value=data))
    return value


def norm_username(raw: str) -> str:
    """'@Ali_01', 'https://t.me/ali_01' → 'ali_01'"""
    u = raw.strip().rsplit("/", 1)[-1].lstrip("@").strip().lower()
    return u


async def subscription_end(db: AsyncSession, user: User) -> datetime | None:
    end = (await db.execute(select(func.max(Subscription.ends_at)).where(Subscription.user_id == user.id))).scalar_one()
    return end


async def member_of(db: AsyncSession, user: User) -> Member | None:
    conds = [Member.telegram_id == user.telegram_id]
    if user.username:
        conds.append(Member.username == user.username.lower())
    m = (await db.execute(select(Member).where(or_(*conds)))).scalars().first()
    if m is not None and m.telegram_id is None:
        m.telegram_id = user.telegram_id  # remember the person, not just the username
        await db.flush()
    return m


async def access_reason(db: AsyncSession, user: User) -> str | None:
    """'staff' | 'open' | 'member' | 'subscription' — or None when the app is closed for this person."""
    if user.role in STAFF:
        return "staff"
    if (await get_access_settings(db)).mode == "open":
        return "open"
    if await member_of(db, user):
        return "member"
    end = await subscription_end(db, user)
    if end and end > utcnow():
        return "subscription"
    return None
