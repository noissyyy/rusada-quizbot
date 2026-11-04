"""Runtime settings, read once from environment variables (see .env.example)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: os.environ.get(
        "DATABASE_URL", "postgresql+asyncpg://rq:rq@localhost:5432/rq"))
    bot_token: str = field(default_factory=lambda: os.environ.get("BOT_TOKEN", ""))
    bot_username: str = field(default_factory=lambda: os.environ.get("BOT_USERNAME", "Rusada_QuizBot"))
    #: secret for admin JWTs — MUST be set in production
    jwt_secret: str = field(default_factory=lambda: os.environ.get("JWT_SECRET", "dev-only-change-me"))
    #: shared secret the bot uses to call /internal/* endpoints
    internal_token: str = field(default_factory=lambda: os.environ.get("INTERNAL_TOKEN", "dev-internal"))
    #: public HTTPS addresses (used in bot buttons and admin login links)
    miniapp_url: str = field(default_factory=lambda: os.environ.get("MINIAPP_URL", "http://localhost:5173"))
    admin_url: str = field(default_factory=lambda: os.environ.get("ADMIN_URL", "http://localhost:5174"))
    #: short name of the Mini App registered in BotFather (/newapp); empty = main Mini App
    miniapp_short_name: str = field(default_factory=lambda: os.environ.get("MINIAPP_SHORT_NAME", ""))
    #: initData older than this is rejected (seconds)
    init_data_max_age: int = field(default_factory=lambda: int(os.environ.get("INIT_DATA_MAX_AGE", "86400")))
    #: lets local dev call the API with `Authorization: dev <telegram_id>` — never enable in production
    allow_dev_auth: bool = field(default_factory=lambda: _bool("ALLOW_DEV_AUTH"))
    cors_origins: tuple[str, ...] = field(default_factory=lambda: tuple(
        o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",") if o.strip()))
    #: grace period for network latency when the test timer runs out (seconds)
    timer_grace_sec: int = 3
    #: whether the API actually calls Telegram (disabled in tests)
    telegram_enabled: bool = field(default_factory=lambda: _bool("TELEGRAM_ENABLED", True))


settings = Settings()
