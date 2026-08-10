"""Добавляет поле краткого названия в checks."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_check_short_name

MIGRATION_STATEMENTS = [
    "ALTER TABLE checks ADD COLUMN IF NOT EXISTS short_name VARCHAR(255)",
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Check short_name migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
