import asyncio
from collections.abc import Sequence

from sqlalchemy import select

from app.db.department_names import DEPARTMENTS
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.departments import Department

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_departments


async def seed_departments(departments: Sequence[str]) -> int:
    if not departments:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        for name in departments:
            name = name.strip()
            if not name:
                continue
            result = await session.execute(
                select(Department).where(Department.name == name)
            )
            if result.scalar_one_or_none():
                continue
            session.add(Department(name=name))
            inserted += 1
        await session.commit()
    return inserted


async def main() -> None:
    await init_db()
    inserted = await seed_departments(DEPARTMENTS)
    print(f"Seeded departments: {inserted}")


if __name__ == "__main__":
    asyncio.run(main())
