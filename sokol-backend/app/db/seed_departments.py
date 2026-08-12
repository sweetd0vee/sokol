import asyncio
from collections.abc import Sequence

from sqlalchemy import func, select

from app.db.department_names import DEPARTMENTS
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.departments import Department
from app.utils.dictionary_text import normalize_dictionary_label

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_departments


async def seed_departments(
    departments: Sequence[str], *, only_if_empty: bool = False
) -> int:
    if not departments:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        if only_if_empty:
            count = int(
                await session.scalar(select(func.count()).select_from(Department)) or 0
            )
            if count:
                return 0

        existing = await session.execute(select(Department))
        existing_normalized = {
            normalize_dictionary_label(row.name) for row in existing.scalars()
        }

        for name in departments:
            normalized = normalize_dictionary_label(name)
            if not normalized or normalized in existing_normalized:
                continue
            session.add(Department(name=normalized))
            existing_normalized.add(normalized)
            inserted += 1
        await session.commit()
    return inserted


async def main() -> None:
    await init_db()
    inserted = await seed_departments(DEPARTMENTS)
    print(f"Seeded departments: {inserted}")


if __name__ == "__main__":
    asyncio.run(main())
