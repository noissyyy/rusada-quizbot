import json
import os
import time

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://rq:rq@localhost:5432/rq_test")
os.environ["BOT_TOKEN"] = "123456:TEST-token"
os.environ["TELEGRAM_ENABLED"] = "0"
os.environ["ALLOW_DEV_AUTH"] = "1"
os.environ["INTERNAL_TOKEN"] = "test-internal"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.security import sign_init_data  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest_asyncio.fixture(scope="session", autouse=True)
async def schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def clean():
    async with engine.begin() as conn:
        names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        await conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    await seed()
    yield


@pytest_asyncio.fixture
async def client():
    app = create_app(run_ticker=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def tma(user_id: int, first_name: str = "Алексей", last_name: str = "Иванов", auth_date: int | None = None) -> dict:
    fields = {"auth_date": str(auth_date or int(time.time())), "query_id": "AAE",
              "user": json.dumps({"id": user_id, "first_name": first_name, "last_name": last_name,
                                  "language_code": "ru"}, ensure_ascii=False)}
    return {"Authorization": "tma " + sign_init_data(fields, os.environ["BOT_TOKEN"])}


@pytest.fixture
def auth():
    return tma


@pytest_asyncio.fixture
async def admin_headers(client):
    r = await client.post("/api/admin/auth/dev", json={"telegramId": 1})
    return {"Authorization": "Bearer " + r.json()["token"]}
