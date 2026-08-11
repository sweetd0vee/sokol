import asyncio
from collections.abc import Sequence

from sqlalchemy import select

from app.db.auditor_names import AUDITORS
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.auditors import Auditor

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_auditors


async def seed_auditors(auditors: Sequence[str]) -> int:
    if not auditors:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        for name in auditors:
            name = name.strip()
            if not name:
                continue
            result = await session.execute(
                select(Auditor).where(Auditor.full_name == name)
            )
            if result.scalar_one_or_none():
                continue
            session.add(Auditor(full_name=name))
            inserted += 1
        await session.commit()
    return inserted


async def main() -> None:
    await init_db()
    inserted = await seed_auditors(AUDITORS)
    print(f"Seeded auditors: {inserted}")


if __name__ == "__main__":
    asyncio.run(main())
