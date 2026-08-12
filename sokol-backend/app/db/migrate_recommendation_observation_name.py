"""Добавляет название наблюдения в recommendations."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_observation_name

MIGRATION_STATEMENTS = [
    """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS observation_name TEXT
    """,
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Recommendation observation_name migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
