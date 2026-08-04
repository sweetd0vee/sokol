"""Добавляет поля оценок эффективности в checks."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_check_effectiveness

MIGRATION_STATEMENTS = [
    "ALTER TABLE checks ADD COLUMN IF NOT EXISTS process_effectiveness VARCHAR(128)",
    "ALTER TABLE checks ADD COLUMN IF NOT EXISTS svk_effectiveness VARCHAR(128)",
    "ALTER TABLE checks ADD COLUMN IF NOT EXISTS sur_effectiveness VARCHAR(128)",
    "ALTER TABLE checks ADD COLUMN IF NOT EXISTS svik_effectiveness VARCHAR(128)",
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Check effectiveness migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
