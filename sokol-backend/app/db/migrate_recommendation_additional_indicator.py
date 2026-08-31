"""Добавляет индикатор дополнительного статуса в recommendations."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_additional_indicator

MIGRATION_STATEMENTS = [
    """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS additional_indicator VARCHAR(32)
    """,
    """
    UPDATE recommendations
    SET additional_indicator = CASE additional_status::text
        WHEN 'on_time' THEN 'в срок'
        WHEN 'deadline_violated' THEN 'срок нарушен'
        WHEN 'on_control' THEN 'на контроле'
        ELSE 'не указан'
    END
    WHERE additional_indicator IS NULL OR additional_indicator = ''
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN additional_indicator SET DEFAULT 'не указан'
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN additional_indicator SET NOT NULL
    """,
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Recommendation additional_indicator migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
