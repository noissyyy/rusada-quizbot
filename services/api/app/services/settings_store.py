from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Setting
from ..schemas import SettingsIn

KEY = "app"


async def get_settings(db: AsyncSession) -> SettingsIn:
    row = await db.get(Setting, KEY)
    return SettingsIn.model_validate(row.value) if row else SettingsIn()


async def save_settings(db: AsyncSession, value: SettingsIn) -> SettingsIn:
    row = await db.get(Setting, KEY)
    data = value.model_dump()
    if row:
        row.value = data
    else:
        db.add(Setting(key=KEY, value=data))
    await db.commit()
    return value
