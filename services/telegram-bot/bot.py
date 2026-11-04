"""@Rusada_QuizBot — Telegram side of the platform.

* /start            → opens the Mini App (deep links: g_<assignment>, l_<live>)
* /admin            → one-time login link to the admin panel (hosts/admins only)
* bot added to a group / promoted → group registered in the admin panel
* /test in a group  → button that opens the Mini App

The token comes ONLY from the BOT_TOKEN environment variable.
"""
from __future__ import annotations

import asyncio
import logging
import os

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ChatType
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (BotCommand, ChatMemberUpdated, InlineKeyboardButton, InlineKeyboardMarkup,
                           MenuButtonWebApp, Message, WebAppInfo)

log = logging.getLogger("rusada-bot")

API_URL = os.environ.get("API_URL", "http://api:8000").rstrip("/")
INTERNAL_TOKEN = os.environ.get("INTERNAL_TOKEN", "dev-internal")
MINIAPP_URL = os.environ.get("MINIAPP_URL", "https://example.com").rstrip("/")
BOT_USERNAME = os.environ.get("BOT_USERNAME", "Rusada_QuizBot")
MINIAPP_SHORT_NAME = os.environ.get("MINIAPP_SHORT_NAME", "")

TEXTS = {
    "uz": {
        "hello": "Assalomu alaykum, {name}! 👋\n\n<b>Rusada QuizBot</b> — rus tilidan testlar: o‘z tempingizda, "
                 "jonli efirda va guruhingiz bilan.\n\nPastdagi tugmani bosing.",
        "open": "QuizBot'ni ochish",
        "admin_no": "Admin panel faqat o‘qituvchilar va administratorlar uchun.",
        "admin_link": "Admin panelga kirish havolasi (5 daqiqa amal qiladi, bir marta ishlaydi):",
        "admin_btn": "Admin panelga kirish",
        "private_only": "Bu buyruq faqat bot bilan shaxsiy chatda ishlaydi.",
        "help": "/start — ilovani ochish\n/admin — admin panel (o‘qituvchilar uchun)",
        "group_hi": "Salom! Men guruhga testlar yuboraman. O‘qituvchi admin paneldan test yuborishi mumkin.\n"
                    "Ishtirokchilarni tekshirishim uchun meni guruh administratori qiling.",
        "group_test": "Testlarni ochish:",
        "error": "Server bilan aloqa yo‘q. Birozdan so‘ng urinib ko‘ring.",
    },
    "ru": {
        "hello": "Здравствуйте, {name}! 👋\n\n<b>Rusada QuizBot</b> — тесты по русскому языку: в своём темпе, "
                 "в прямом эфире и вместе с группой.\n\nНажмите кнопку ниже.",
        "open": "Открыть QuizBot",
        "admin_no": "Админ-панель доступна только преподавателям и администраторам.",
        "admin_link": "Ссылка для входа в админ-панель (действует 5 минут, одноразовая):",
        "admin_btn": "Войти в админ-панель",
        "private_only": "Эта команда работает только в личном чате с ботом.",
        "help": "/start — открыть приложение\n/admin — админ-панель (для преподавателей)",
        "group_hi": "Привет! Я присылаю тесты в группу. Преподаватель отправляет их из админ-панели.\n"
                    "Сделайте меня администратором, чтобы я мог проверять участников.",
        "group_test": "Открыть тесты:",
        "error": "Нет связи с сервером. Попробуйте чуть позже.",
    },
}


def lang_of(code: str | None) -> str:
    return "ru" if (code or "").lower().startswith("ru") else "uz"


def t(code: str | None, key: str, **kw: str) -> str:
    return TEXTS[lang_of(code)][key].format(**kw)


def miniapp_url(start: str | None = None) -> str:
    """URL for a web_app button. Start params are passed as ?start= (web_app buttons ignore startapp)."""
    return f"{MINIAPP_URL}/?start={start}" if start else f"{MINIAPP_URL}/"


def startapp_link(param: str) -> str:
    base = f"https://t.me/{BOT_USERNAME}" + (f"/{MINIAPP_SHORT_NAME}" if MINIAPP_SHORT_NAME else "")
    return f"{base}?startapp={param}"


def valid_start_param(param: str | None) -> str | None:
    if param and len(param) <= 64 and param[:2] in ("g_", "l_", "t_") and param[2:].isalnum():
        return param
    return None


def user_payload(u) -> dict:
    return {"id": u.id, "first_name": u.first_name or "", "last_name": u.last_name, "username": u.username,
            "language_code": u.language_code}


async def api(method: str, path: str, json: dict | None = None) -> httpx.Response:
    async with httpx.AsyncClient(timeout=10) as c:
        return await c.request(method, f"{API_URL}{path}", json=json, headers={"X-Internal-Token": INTERNAL_TOKEN})


router = Router()


@router.message(CommandStart(), F.chat.type == ChatType.PRIVATE)
async def start(message: Message, command: CommandObject) -> None:
    u = message.from_user
    try:
        await api("POST", "/internal/users", user_payload(u))
    except httpx.HTTPError:
        log.warning("API unreachable on /start")
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=t(u.language_code, "open"), web_app=WebAppInfo(url=miniapp_url(valid_start_param(command.args))))]])
    await message.answer(t(u.language_code, "hello", name=u.first_name or ""), reply_markup=kb, parse_mode="HTML")


@router.message(Command("admin"))
async def admin(message: Message) -> None:
    u = message.from_user
    if message.chat.type != ChatType.PRIVATE:
        await message.reply(t(u.language_code, "private_only"))
        return
    try:
        r = await api("POST", "/internal/admin-login", user_payload(u))
    except httpx.HTTPError:
        await message.answer(t(u.language_code, "error"))
        return
    if r.status_code == 403:
        await message.answer(t(u.language_code, "admin_no"))
        return
    url = r.json()["url"]
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=t(u.language_code, "admin_btn"), url=url)]])
    await message.answer(t(u.language_code, "admin_link"), reply_markup=kb)


@router.message(Command("help"))
async def help_(message: Message) -> None:
    await message.answer(t(message.from_user.language_code, "help"))


@router.message(Command("test"), F.chat.type.in_({ChatType.GROUP, ChatType.SUPERGROUP}))
async def group_test(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Rusada QuizBot",
                                                                     url=startapp_link("home"))]])
    await message.reply(t(message.from_user.language_code, "group_test"), reply_markup=kb)


async def sync_group(bot: Bot, chat, added_by=None, active: bool = True) -> None:
    me = await bot.get_me()
    try:
        member = await bot.get_chat_member(chat.id, me.id)
        is_admin = member.status in ("administrator", "creator")
        count = await bot.get_chat_member_count(chat.id) if active else 0
    except Exception:  # noqa: BLE001 — the bot may already be removed
        is_admin, count = False, 0
    payload = {"chat_id": chat.id, "title": chat.title or str(chat.id), "username": chat.username,
               "bot_is_admin": is_admin, "members_count": count, "is_active": active,
               "added_by": user_payload(added_by) if added_by else None}
    try:
        await api("POST", "/internal/groups", payload)
    except httpx.HTTPError:
        log.warning("could not register group %s", chat.id)


@router.my_chat_member()
async def on_my_status(event: ChatMemberUpdated, bot: Bot) -> None:
    if event.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        return
    new = event.new_chat_member.status
    active = new in ("member", "administrator", "creator")
    was_out = event.old_chat_member.status in ("left", "kicked")
    await sync_group(bot, event.chat, event.from_user, active=active)
    if active and was_out:
        await bot.send_message(event.chat.id, t(event.from_user.language_code, "group_hi"))


@router.message(F.chat.type.in_({ChatType.GROUP, ChatType.SUPERGROUP}))
async def seen_in_group(message: Message) -> None:
    """Remembers who writes in the group (helps the membership check if the bot is not admin)."""
    if message.from_user and not message.from_user.is_bot:
        try:
            await api("POST", "/internal/groups/members", {"chat_id": message.chat.id,
                                                           "user": user_payload(message.from_user)})
        except httpx.HTTPError:
            pass


async def setup(bot: Bot) -> None:
    await bot.set_my_commands([BotCommand(command="start", description="Открыть QuizBot"),
                               BotCommand(command="help", description="Помощь"),
                               BotCommand(command="admin", description="Админ-панель (для преподавателей)")])
    await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="QuizBot", web_app=WebAppInfo(url=miniapp_url())))


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    token = os.environ.get("BOT_TOKEN")
    if not token:
        raise SystemExit("BOT_TOKEN is not set")
    bot = Bot(token)
    dp = Dispatcher()
    dp.include_router(router)
    await setup(bot)
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())
