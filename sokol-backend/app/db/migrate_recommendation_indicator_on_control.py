"""Переименовывает индикатор «ожидает» в «на контроле»."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_indicator_on_control

STATEMENTS = [
    """
    UPDATE recommendations
    SET indicator = 'на контроле'
    WHERE lower(trim(indicator)) IN ('ожидает', 'жёлтый', 'желтый')
    """,
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in STATEMENTS:
            await conn.execute(text(statement))
    print("recommendation indicator migrated: 'ожидает' -> 'на контроле'")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
