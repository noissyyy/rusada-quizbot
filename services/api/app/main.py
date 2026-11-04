from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import SessionLocal
from .routers import admin_api, app_api, internal
from .services import live as live_svc
from .services.settings_store import get_settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rq")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.jwt_secret == "dev-only-change-me" and not settings.allow_dev_auth:
        raise RuntimeError("JWT_SECRET must be set in production")
    if not settings.bot_token and not settings.allow_dev_auth:
        raise RuntimeError("BOT_TOKEN must be set (initData cannot be validated without it)")
    stop = asyncio.Event()
    task = asyncio.create_task(live_svc.ticker(stop)) if app.state.run_ticker else None
    yield
    stop.set()
    if task:
        with contextlib.suppress(Exception):
            await task


def create_app(run_ticker: bool = True) -> FastAPI:
    app = FastAPI(title="Rusada QuizBot API", version="1.0.0", lifespan=lifespan)
    app.state.run_ticker = run_ticker
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=False,
                       allow_methods=["*"], allow_headers=["*"])

    hits: dict[str, deque[float]] = defaultdict(deque)
    limit_cache = {"value": 120, "at": 0.0}

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        """Per-client sliding window (requests / minute), configured in admin settings."""
        if request.url.path.startswith("/api"):
            now = time.monotonic()
            if now - limit_cache["at"] > 30:
                async with SessionLocal() as db:
                    limit_cache["value"] = (await get_settings(db)).rate_limit_per_min
                limit_cache["at"] = now
            key = request.headers.get("authorization", "")[-48:] or (request.client.host if request.client else "?")
            q = hits[key]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= limit_cache["value"]:
                return JSONResponse({"detail": "too_many_requests"}, status_code=429)
            q.append(now)
        return await call_next(request)

    app.include_router(app_api.router)
    app.include_router(admin_api.router)
    app.include_router(internal.router)

    @app.get("/health")
    async def health():
        return {"ok": True}

    return app


app = create_app()
