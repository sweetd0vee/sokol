import asyncio
from collections.abc import Sequence

from sqlalchemy import select

from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.effectiveness_ratings import EffectivenessRating

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_effectiveness_ratings

EFFECTIVENESS_RATINGS = [
    "эффективно",
    "достаточно эффективно",
    "недостаточно эффективно",
    "неэффективно",
    "не оценивалось",
]


async def seed_effectiveness_ratings(ratings: Sequence[str]) -> int:
    if not ratings:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        for label in ratings:
            label = label.strip()
            if not label:
                continue
            result = await session.execute(
                select(EffectivenessRating).where(EffectivenessRating.label == label)
            )
            if result.scalar_one_or_none():
                continue
            session.add(EffectivenessRating(label=label))
            inserted += 1
        await session.commit()
    return inserted


async def main() -> None:
    await init_db()
    inserted = await seed_effectiveness_ratings(EFFECTIVENESS_RATINGS)
    print(f"Seeded effectiveness ratings: {inserted}")


if __name__ == "__main__":
    asyncio.run(main())
