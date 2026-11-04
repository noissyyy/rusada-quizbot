"""Authentication.

* Mini App: `Authorization: tma <initData>` — HMAC-SHA256 validated with the bot
  token exactly as Telegram documents. initDataUnsafe on the client is never trusted.
* Admin panel: no passwords. A host/admin asks the bot for a one-time login link
  (/admin), the link is exchanged for a short-lived JWT.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import parse_qsl

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import get_db
from .models import ROLES, AdminLoginToken, User, utcnow


class InitDataError(ValueError):
    pass


@dataclass
class TgUser:
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    language_code: str | None = None
    photo_url: str | None = None
    start_param: str | None = None


def validate_init_data(init_data: str, bot_token: str, max_age: int, now: float | None = None) -> TgUser:
    pairs = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=False))
    received = pairs.pop("hash", None)
    if not received:
        raise InitDataError("hash missing")
    # every other field (incl. `signature`) is part of the data-check string
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        raise InitDataError("bad signature")
    try:
        auth_date = int(pairs.get("auth_date", "0"))
    except ValueError as e:
        raise InitDataError("bad auth_date") from e
    if (now or time.time()) - auth_date > max_age:
        raise InitDataError("initData expired")
    try:
        u = json.loads(pairs["user"])
    except (KeyError, json.JSONDecodeError) as e:
        raise InitDataError("user missing") from e
    return TgUser(id=int(u["id"]), first_name=u.get("first_name", ""), last_name=u.get("last_name"),
                  username=u.get("username"), language_code=u.get("language_code"), photo_url=u.get("photo_url"),
                  start_param=pairs.get("start_param"))


def sign_init_data(fields: dict[str, str], bot_token: str) -> str:
    """Test helper: builds initData the way Telegram does."""
    from urllib.parse import urlencode
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    return urlencode({**fields, "hash": h})


async def upsert_user(db: AsyncSession, tg: TgUser) -> User:
    user = (await db.execute(select(User).where(User.telegram_id == tg.id))).scalar_one_or_none()
    if user is None:
        user = User(telegram_id=tg.id)
        db.add(user)
    user.first_name = tg.first_name or user.first_name
    user.last_name = tg.last_name
    user.username = tg.username
    user.language_code = tg.language_code
    if tg.photo_url:
        user.photo_url = tg.photo_url
    user.last_seen_at = utcnow()
    if tg.id in settings_superadmins():
        user.role = "superadmin"
    await db.commit()
    return user


def settings_superadmins() -> set[int]:
    import os
    return {int(x) for x in os.environ.get("SUPERADMIN_TELEGRAM_IDS", "").replace(" ", "").split(",") if x}


async def current_user(authorization: str = Header(default=""), db: AsyncSession = Depends(get_db)) -> User:
    scheme, _, value = authorization.partition(" ")
    if scheme == "tma" and value:
        try:
            tg = validate_init_data(value, settings.bot_token, settings.init_data_max_age)
        except InitDataError as e:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"initData: {e}") from e
    elif scheme == "dev" and settings.allow_dev_auth and value.isdigit():
        tg = TgUser(id=int(value), first_name="Dev", last_name="User")
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Open the app from Telegram")
    user = await upsert_user(db, tg)
    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "blocked")
    return user


# ---------------- admin ----------------

def role_at_least(role: str, needed: str) -> bool:
    return ROLES.index(role) >= ROLES.index(needed)


async def issue_login_token(db: AsyncSession, user: User, ttl_sec: int = 300) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AdminLoginToken(token=token, user_id=user.id, expires_at=utcnow() + timedelta(seconds=ttl_sec)))
    await db.commit()
    return token


def make_admin_jwt(user: User, hours: int = 12) -> str:
    now = int(time.time())
    return jwt.encode({"sub": user.id, "role": user.role, "iat": now, "exp": now + hours * 3600},
                      settings.jwt_secret, algorithm="HS256")


async def exchange_login_token(db: AsyncSession, token: str) -> User:
    row = await db.get(AdminLoginToken, token)
    if row is None or row.used or row.expires_at < utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Ссылка для входа устарела. Запросите новую в боте: /admin")
    row.used = True
    user = await db.get(User, row.user_id)
    await db.commit()
    if user is None or not role_at_least(user.role, "host"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет доступа к админ-панели")
    return user


def require_role(needed: str):
    async def dep(authorization: str = Header(default=""), db: AsyncSession = Depends(get_db)) -> User:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() != "bearer" or not value:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "login required")
        try:
            payload = jwt.decode(value, settings.jwt_secret, algorithms=["HS256"])
        except jwt.PyJWTError as e:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "session expired") from e
        user = await db.get(User, payload["sub"])
        # role is re-read from the DB so a demotion takes effect immediately
        if user is None or user.is_blocked or not role_at_least(user.role, needed):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "forbidden")
        return user
    return dep


async def require_internal(x_internal_token: str = Header(default="")) -> None:
    if not hmac.compare_digest(x_internal_token, settings.internal_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "internal only")
