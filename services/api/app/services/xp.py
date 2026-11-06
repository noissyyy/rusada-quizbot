"""XP and levels. Level n starts at 50·n·(n−1) XP: 2 → 100, 3 → 300, 4 → 600, 5 → 1000 …"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import XpEvent

#: single-player games that report a score; the XP of one round is capped
GAME_XP_CAP = {"wordsearch": 50, "memory": 40, "morph": 50, "grammar": 50, "attack": 60, "lastword": 60}


def level_start(n: int) -> int:
    return 50 * n * (n - 1)


def level_of(xp: int) -> int:
    n = 1
    while level_start(n + 1) <= xp:
        n += 1
    return n


def award(db: AsyncSession, user_id: str, amount: int, source: str) -> None:
    if amount > 0:
        db.add(XpEvent(user_id=user_id, amount=int(amount), source=source))


async def total(db: AsyncSession, user_id: str) -> int:
    return (await db.execute(select(func.coalesce(func.sum(XpEvent.amount), 0)).where(XpEvent.user_id == user_id))).scalar_one()


async def summary(db: AsyncSession, user_id: str) -> dict[str, int]:
    xp = await total(db, user_id)
    lvl = level_of(xp)
    return {"xp": xp, "level": lvl, "levelStart": level_start(lvl), "levelNext": level_start(lvl + 1)}
