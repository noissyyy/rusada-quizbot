"""Access control and manual card payments.

Mini App: what the person may do, the price and card details, sending a receipt.
Admin: open/closed mode, the Rusada student list, receipts to approve, subscriptions.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from .. import telegram
from ..config import settings
from ..db import get_db
from ..models import Member, PaymentRequest, Subscription, User, utcnow
from ..schemas import Camel
from ..security import require_role, settings_superadmins, telegram_user
from ..services import pdf_pages
from ..services.access import (AccessSettings, access_reason, get_access_settings, member_of, norm_username,
                               save_access_settings, subscription_end)
from .admin_api import audit

log = logging.getLogger(__name__)
router = APIRouter(tags=["access"])
admin = require_role("admin")
MAX_RECEIPT = 10 * 1024 * 1024
RECEIPT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


def _fmt_day(dt: datetime) -> str:
    return (dt + timedelta(hours=5)).strftime("%d.%m.%Y")  # Tashkent


async def _notify(chat_id: int | None, text: str, button: tuple[str, str] | None = None) -> None:
    """Best effort: a failed Telegram message must never break the request."""
    if not chat_id or not settings.telegram_enabled:
        return
    try:
        await telegram.send_message(chat_id, text, button)
    except Exception:  # noqa: BLE001
        log.warning("telegram notify failed for %s", chat_id, exc_info=True)


def _app_button(label: str) -> tuple[str, str] | None:
    return (label, telegram.startapp_link("")) if settings.miniapp_url else None


# ---------------- mini app ----------------

class PendingOut(Camel):
    id: str
    created_at: datetime


class AccessOut(Camel):
    telegram_id: int
    username: str | None
    has_access: bool
    reason: str | None  # staff | open | member | subscription
    mode: str
    subscription_ends_at: datetime | None
    price_uzs: int
    days: int
    card_number: str
    card_holder: str
    note: str
    support_username: str
    pending: PendingOut | None
    rejected_comment: str | None


@router.get("/api/access", response_model=AccessOut)
async def my_access(user: User = Depends(telegram_user), db: AsyncSession = Depends(get_db)):
    cfg = await get_access_settings(db)
    reason = await access_reason(db, user)
    end = await subscription_end(db, user)
    last = (await db.execute(select(PaymentRequest).where(PaymentRequest.user_id == user.id)
                             .order_by(PaymentRequest.created_at.desc()).limit(1))).scalars().first()
    await db.commit()
    return AccessOut(telegram_id=user.telegram_id, username=user.username, has_access=reason is not None, reason=reason, mode=cfg.mode,
                     subscription_ends_at=end if end and end > utcnow() else None,
                     price_uzs=cfg.price_uzs, days=cfg.days, card_number=cfg.card_number, card_holder=cfg.card_holder,
                     note=cfg.note, support_username=cfg.support_username,
                     pending=PendingOut(id=last.id, created_at=last.created_at) if last and last.status == "pending" else None,
                     rejected_comment=(last.comment or "—") if last and last.status == "rejected" else None)


@router.post("/api/payments", response_model=PendingOut)
async def send_receipt(file: UploadFile = File(...), user: User = Depends(telegram_user), db: AsyncSession = Depends(get_db)):
    """The student transferred money to the card and sends a screenshot of the receipt."""
    pending = (await db.execute(select(PaymentRequest).where(PaymentRequest.user_id == user.id,
                                                             PaymentRequest.status == "pending"))).scalars().first()
    if pending:
        raise HTTPException(409, "already_pending")
    data = await file.read(MAX_RECEIPT + 1)
    if len(data) > MAX_RECEIPT:
        raise HTTPException(422, "receipt_too_big")
    if (file.content_type or "") not in RECEIPT_TYPES:
        raise HTTPException(422, "receipt_not_image")
    try:  # store a light JPEG; also proves it is a real picture
        data = await run_in_threadpool(pdf_pages.shrink_cover, data, 1400)
    except ValueError:
        raise HTTPException(422, "receipt_not_image") from None
    cfg = await get_access_settings(db)
    p = PaymentRequest(user_id=user.id, amount=cfg.price_uzs, days=cfg.days, receipt=data, receipt_type="image/jpeg")
    db.add(p)
    await db.commit()
    who = user.display_name + (f" (@{user.username})" if user.username else "")
    admins = set(settings_superadmins()) | set((await db.execute(
        select(User.telegram_id).where(User.role.in_(("admin", "superadmin"))))).scalars())
    for tid in admins:
        await _notify(tid, f"💳 <b>Новый чек на оплату</b>\n{who} · {cfg.price_uzs:,} сум за {cfg.days} дн.".replace(",", " "),
                      ("Проверить", f"{settings.admin_url.rstrip('/')}/access") if settings.admin_url else None)
    return PendingOut(id=p.id, created_at=p.created_at)


# ---------------- admin: settings ----------------

@router.get("/api/admin/access", response_model=AccessSettings)
async def read_access(user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    return await get_access_settings(db)


@router.put("/api/admin/access", response_model=AccessSettings)
async def write_access(body: AccessSettings, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    body.card_number = " ".join(body.card_number.split())
    body.support_username = norm_username(body.support_username)
    old = await get_access_settings(db)
    await save_access_settings(db, body)
    if old.mode != body.mode:
        await audit(db, user, "access.mode", None, mode=body.mode)
    await db.commit()
    return body


# ---------------- admin: Rusada students ----------------

class MemberOut(Camel):
    id: str
    username: str | None
    telegram_id: int | None
    note: str
    seen: bool  # opened the app at least once (Telegram ID remembered)
    name: str | None
    added_at: datetime


@router.get("/api/admin/members", response_model=list[MemberOut])
async def list_members(user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Member).order_by(Member.added_at.desc()))).scalars().all()
    tids = [m.telegram_id for m in rows if m.telegram_id]
    names = dict((await db.execute(select(User.telegram_id, User.first_name).where(User.telegram_id.in_(tids)))).all()) if tids else {}
    return [MemberOut(id=m.id, username=m.username, telegram_id=m.telegram_id, note=m.note,
                      seen=m.telegram_id is not None and m.telegram_id in names,
                      name=names.get(m.telegram_id), added_at=m.added_at) for m in rows]


class MembersIn(Camel):
    #: any text: @usernames and/or Telegram IDs (digits), separated by spaces, commas or new lines
    usernames: str = Field(min_length=1, max_length=50_000)
    note: str = Field(default="", max_length=200)


@router.post("/api/admin/members")
async def add_members(body: MembersIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    import re
    found = {norm_username(x) for x in re.split(r"[\s,;]+", body.usernames) if x.strip()}
    ids = {int(u) for u in found if re.fullmatch(r"\d{5,15}", u)}
    names = {u for u in found if re.fullmatch(r"[a-z][a-z0-9_]{3,31}", u)}
    invalid = sorted(found - names - {str(i) for i in ids})
    have_names = set((await db.execute(select(Member.username).where(Member.username.in_(names)))).scalars()) if names else set()
    have_ids = set((await db.execute(select(Member.telegram_id).where(Member.telegram_id.in_(ids)))).scalars()) if ids else set()
    for u in sorted(names - have_names):
        db.add(Member(username=u, note=body.note))
    for i in sorted(ids - have_ids):
        db.add(Member(username=None, telegram_id=i, note=body.note))
    added = len(names - have_names) + len(ids - have_ids)
    await audit(db, user, "members.add", None, count=added)
    await db.commit()
    return {"added": added, "already": len(have_names) + len(have_ids), "invalid": invalid}


@router.delete("/api/admin/members/{mid}", status_code=204)
async def delete_member(mid: str, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    m = await db.get(Member, mid)
    if m is None:
        raise HTTPException(404)
    await db.delete(m)
    await audit(db, user, "members.remove", None, username=m.username, telegramId=m.telegram_id)
    await db.commit()


# ---------------- admin: payments ----------------

class PaymentOut(Camel):
    id: str
    user_id: str
    name: str
    username: str | None
    status: str
    amount: int
    days: int
    comment: str
    created_at: datetime
    decided_at: datetime | None
    subscription_ends_at: datetime | None


async def _payment_out(db: AsyncSession, p: PaymentRequest) -> PaymentOut:
    end = await subscription_end(db, p.user)
    return PaymentOut(id=p.id, user_id=p.user_id, name=p.user.display_name, username=p.user.username, status=p.status,
                      amount=p.amount, days=p.days, comment=p.comment, created_at=p.created_at, decided_at=p.decided_at,
                      subscription_ends_at=end)


@router.get("/api/admin/payments", response_model=list[PaymentOut])
async def list_payments(status: str | None = None, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    stmt = select(PaymentRequest).order_by(PaymentRequest.created_at.desc()).limit(200)
    if status:
        stmt = stmt.where(PaymentRequest.status == status)
    return [await _payment_out(db, p) for p in (await db.execute(stmt)).unique().scalars().all()]


@router.get("/api/admin/payments/{pid}/receipt")
async def payment_receipt(pid: str, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(PaymentRequest).options(undefer(PaymentRequest.receipt))
                          .where(PaymentRequest.id == pid))).unique().scalar_one_or_none()
    if p is None or not p.receipt:
        raise HTTPException(404)
    return Response(p.receipt, media_type=p.receipt_type or "image/jpeg", headers={"Cache-Control": "private, no-store"})


async def _grant(db: AsyncSession, target: User, days: int, by: User, source: str, payment_id: str | None = None) -> datetime:
    """Adds `days` after the current subscription (or from now if there is none)."""
    end = await subscription_end(db, target)
    start = end if end and end > utcnow() else utcnow()
    new_end = start + timedelta(days=days)
    db.add(Subscription(user_id=target.id, starts_at=start, ends_at=new_end, source=source, payment_id=payment_id,
                        created_by=by.id))
    return new_end


@router.post("/api/admin/payments/{pid}/approve", response_model=PaymentOut)
async def approve_payment(pid: str, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    p = await db.get(PaymentRequest, pid)
    if p is None:
        raise HTTPException(404)
    if p.status != "pending":
        raise HTTPException(409, "Эта заявка уже рассмотрена")
    end = await _grant(db, p.user, p.days, user, "payment", p.id)
    p.status, p.decided_at, p.decided_by = "approved", utcnow(), user.id
    await audit(db, user, "payment.approve", p.id, user=p.user.display_name, days=p.days)
    await db.commit()
    await _notify(p.user.telegram_id, f"✅ <b>Оплата подтверждена</b>\nДоступ открыт до {_fmt_day(end)}. Удачной подготовки!\n\n"
                                      f"✅ <b>To‘lov tasdiqlandi</b>\nKirish {_fmt_day(end)} gacha ochiq.", _app_button("Открыть · Ochish"))
    return await _payment_out(db, await db.get(PaymentRequest, pid, populate_existing=True))


class RejectIn(Camel):
    comment: str = Field(default="", max_length=300)


@router.post("/api/admin/payments/{pid}/reject", response_model=PaymentOut)
async def reject_payment(pid: str, body: RejectIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    p = await db.get(PaymentRequest, pid)
    if p is None:
        raise HTTPException(404)
    if p.status != "pending":
        raise HTTPException(409, "Эта заявка уже рассмотрена")
    p.status, p.decided_at, p.decided_by, p.comment = "rejected", utcnow(), user.id, body.comment.strip()
    await audit(db, user, "payment.reject", p.id, user=p.user.display_name)
    await db.commit()
    reason = f"\nПричина: {p.comment}" if p.comment else ""
    await _notify(p.user.telegram_id, f"❌ <b>Чек не подтверждён</b>{reason}\nПроверьте перевод и отправьте чек ещё раз.\n\n"
                                      f"❌ <b>Chek tasdiqlanmadi</b>{reason.replace('Причина', 'Sabab')}", _app_button("Открыть · Ochish"))
    return await _payment_out(db, await db.get(PaymentRequest, pid, populate_existing=True))


# ---------------- admin: subscriptions ----------------

class SubscriberOut(Camel):
    user_id: str
    name: str
    username: str | None
    ends_at: datetime
    active: bool


@router.get("/api/admin/subscriptions", response_model=list[SubscriberOut])
async def list_subscribers(user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Subscription.user_id, func.max(Subscription.ends_at))
                             .group_by(Subscription.user_id).order_by(func.max(Subscription.ends_at).desc()))).all()
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_([r[0] for r in rows])))).scalars()} if rows else {}
    now = utcnow()
    return [SubscriberOut(user_id=uid, name=users[uid].display_name, username=users[uid].username, ends_at=end, active=end > now)
            for uid, end in rows if uid in users]


class GrantIn(Camel):
    #: @username or Telegram ID
    username: str = Field(min_length=1, max_length=64)
    days: int = Field(default=30, ge=1, le=3660)


@router.post("/api/admin/subscriptions", response_model=SubscriberOut)
async def grant_subscription(body: GrantIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    """Give or extend access by hand (e.g. paid in cash)."""
    u = norm_username(body.username)
    who = select(User).where(User.telegram_id == int(u)) if u.isdigit() else select(User).where(func.lower(User.username) == u)
    target = (await db.execute(who)).scalars().first()
    if target is None:
        label = f"ID {u}" if u.isdigit() else f"@{u}"
        raise HTTPException(404, f"{label} ещё не открывал бота — попросите его нажать /start, потом повторите")
    end = await _grant(db, target, body.days, user, "manual")
    await audit(db, user, "subscription.grant", target.id, days=body.days)
    await db.commit()
    await _notify(target.telegram_id, f"🎁 Доступ открыт до {_fmt_day(end)}.\n🎁 Kirish {_fmt_day(end)} gacha ochiq.", _app_button("Открыть · Ochish"))
    return SubscriberOut(user_id=target.id, name=target.display_name, username=target.username, ends_at=end, active=True)


@router.delete("/api/admin/subscriptions/{uid}", status_code=204)
async def revoke_subscription(uid: str, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    """Ends the person's access now (their periods are cut to this moment)."""
    now = utcnow()
    rows = (await db.execute(select(Subscription).where(Subscription.user_id == uid, Subscription.ends_at > now))).scalars().all()
    for s in rows:
        if s.starts_at >= now:
            await db.delete(s)  # a period that has not started yet
        else:
            s.ends_at = now
    await audit(db, user, "subscription.revoke", uid)
    await db.commit()


@router.get("/api/admin/access/stats")
async def access_stats(user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    now = utcnow()
    pending = (await db.execute(select(func.count()).select_from(PaymentRequest).where(PaymentRequest.status == "pending"))).scalar_one()
    active = (await db.execute(select(func.count(func.distinct(Subscription.user_id))).where(Subscription.ends_at > now))).scalar_one()
    members = (await db.execute(select(func.count()).select_from(Member))).scalar_one()
    return {"pending": pending, "activeSubscribers": active, "members": members}
