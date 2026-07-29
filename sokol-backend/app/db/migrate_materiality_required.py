"""Убирает значение «не указан» у materiality_level и меняет DEFAULT на «средний»."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_materiality_required

STATEMENTS = [
    """
    UPDATE recommendations
    SET materiality_level = 'средний'
    WHERE materiality_level IS NULL
       OR materiality_level = ''
       OR materiality_level = 'не указан'
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN materiality_level SET DEFAULT 'средний'
    """,
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in STATEMENTS:
            await conn.execute(text(statement))
    print("materiality_level updated: 'не указан' -> 'средний', default = 'средний'")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
