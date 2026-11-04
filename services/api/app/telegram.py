"""Outgoing Telegram Bot API calls made by the API (group posts, notifications,
membership checks). Incoming updates are handled by services/telegram-bot."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from .config import settings

log = logging.getLogger(__name__)


class TelegramError(RuntimeError):
    pass


async def call(method: str, **params: Any) -> Any:
    if not settings.telegram_enabled or not settings.bot_token:
        log.info("telegram disabled: %s %s", method, params)
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"https://api.telegram.org/bot{settings.bot_token}/{method}", json=params)
    data = r.json()
    if not data.get("ok"):
        raise TelegramError(data.get("description", "telegram error"))
    return data["result"]


def startapp_link(param: str) -> str:
    """t.me deep link that opens the Mini App with a start parameter (works in groups)."""
    base = f"https://t.me/{settings.bot_username}"
    if settings.miniapp_short_name:
        base += f"/{settings.miniapp_short_name}"
    return f"{base}?startapp={param}"


async def send_message(chat_id: int, text: str, button: tuple[str, str] | None = None) -> int | None:
    params: dict[str, Any] = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if button:
        params["reply_markup"] = {"inline_keyboard": [[{"text": button[0], "url": button[1]}]]}
    res = await call("sendMessage", **params)
    return res["message_id"] if res else None


async def is_member(chat_id: int, telegram_user_id: int) -> bool | None:
    """True/False when Telegram answers, None when it cannot be checked (bot not admin, disabled)."""
    try:
        res = await call("getChatMember", chat_id=chat_id, user_id=telegram_user_id)
    except (TelegramError, httpx.HTTPError):
        return None
    if res is None:
        return None
    return res.get("status") in {"creator", "administrator", "member", "restricted"}
