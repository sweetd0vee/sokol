import asyncio
from collections.abc import Sequence

from sqlalchemy import func, select

from app.db.auditor_names import AUDITORS
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.auditors import Auditor
from app.utils.dictionary_text import normalize_dictionary_label

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_auditors


async def seed_auditors(
    auditors: Sequence[str], *, only_if_empty: bool = False
) -> int:
    if not auditors:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        if only_if_empty:
            count = int(
                await session.scalar(select(func.count()).select_from(Auditor)) or 0
            )
            if count:
                return 0

        existing = await session.execute(select(Auditor))
        existing_normalized = {
            normalize_dictionary_label(row.full_name)
            for row in existing.scalars()
        }

        for name in auditors:
            normalized = normalize_dictionary_label(name)
            if not normalized or normalized in existing_normalized:
                continue
            session.add(Auditor(full_name=normalized))
            existing_normalized.add(normalized)
            inserted += 1
        await session.commit()
    return inserted


async def main() -> None:
    await init_db()
    inserted = await seed_auditors(AUDITORS)
    print(f"Seeded auditors: {inserted}")


if __name__ == "__main__":
    asyncio.run(main())
