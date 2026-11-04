"""Endpoints for the Telegram bot process only (header X-Internal-Token)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..models import Group, GroupMember, User
from ..security import TgUser, issue_login_token, require_internal, role_at_least, upsert_user

router = APIRouter(prefix="/internal", tags=["internal"], dependencies=[Depends(require_internal)])


class TgUserIn(BaseModel):
    id: int
    first_name: str = ""
    last_name: str | None = None
    username: str | None = None
    language_code: str | None = None


class GroupIn(BaseModel):
    chat_id: int
    title: str
    username: str | None = None
    bot_is_admin: bool = False
    members_count: int = 0
    is_active: bool = True
    added_by: TgUserIn | None = None


class MemberIn(BaseModel):
    chat_id: int
    user: TgUserIn


def _tg(u: TgUserIn) -> TgUser:
    return TgUser(id=u.id, first_name=u.first_name, last_name=u.last_name, username=u.username,
                  language_code=u.language_code)


@router.post("/users")
async def upsert(body: TgUserIn, db: AsyncSession = Depends(get_db)):
    user = await upsert_user(db, _tg(body))
    return {"id": user.id, "role": user.role, "lang": user.lang}


@router.post("/admin-login")
async def admin_login(body: TgUserIn, db: AsyncSession = Depends(get_db)):
    user = await upsert_user(db, _tg(body))
    if not role_at_least(user.role, "host"):
        raise HTTPException(403, "not staff")
    token = await issue_login_token(db, user)
    return {"url": f"{settings.admin_url.rstrip('/')}/login?t={token}", "role": user.role}


@router.post("/groups")
async def upsert_group(body: GroupIn, db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(Group).where(Group.chat_id == body.chat_id))).unique().scalar_one_or_none()
    if g is None:
        g = Group(chat_id=body.chat_id, title=body.title)
        db.add(g)
    g.title, g.username, g.bot_is_admin, g.is_active = body.title, body.username, body.bot_is_admin, body.is_active
    if body.members_count:
        g.members_count = body.members_count
    if body.added_by:
        adder = await upsert_user(db, _tg(body.added_by))
        if g.host_id is None and role_at_least(adder.role, "host"):
            g.host_id = adder.id
    await db.commit()
    return {"id": g.id}


@router.post("/groups/members")
async def seen_member(body: MemberIn, db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(Group).where(Group.chat_id == body.chat_id))).unique().scalar_one_or_none()
    if g is None:
        raise HTTPException(404, "group unknown")
    user = await upsert_user(db, _tg(body.user))
    m = await db.get(GroupMember, (g.id, user.id))
    if m is None:
        db.add(GroupMember(group_id=g.id, user_id=user.id))
    await db.commit()
    return {"ok": True}


@router.get("/staff-users")
async def staff(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).where(User.role != "student"))).scalars()
    return [{"telegramId": u.telegram_id, "role": u.role} for u in rows]
