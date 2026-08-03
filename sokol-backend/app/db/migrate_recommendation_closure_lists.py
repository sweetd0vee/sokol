"""Добавляет JSON-списки переносов срока и снятий с контроля."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_closure_lists

MIGRATION_STATEMENTS = [
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS deadline_extensions JSONB",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS control_removals JSONB",
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Recommendation closure lists migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
