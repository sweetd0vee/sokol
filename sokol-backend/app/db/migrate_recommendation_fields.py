"""Добавляет sequence_number, description и materiality_level в recommendations."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_fields

MIGRATION_STATEMENTS = [
    """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS sequence_number INTEGER
    """,
    """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS description TEXT
    """,
    """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS materiality_level VARCHAR(32)
    """,
    """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS indicator VARCHAR(32)
    """,
    """
    UPDATE recommendations
    SET description = name
    WHERE description IS NULL OR description = ''
    """,
    """
    UPDATE recommendations
    SET materiality_level = 'не указан'
    WHERE materiality_level IS NULL OR materiality_level = ''
    """,
    """
    UPDATE recommendations
    SET indicator = 'не указан'
    WHERE indicator IS NULL OR indicator = ''
    """,
    """
    WITH ranked AS (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY check_id
                ORDER BY created_at, id
            ) AS seq
        FROM recommendations
    )
    UPDATE recommendations AS r
    SET sequence_number = ranked.seq
    FROM ranked
    WHERE r.id = ranked.id
      AND (r.sequence_number IS NULL OR r.sequence_number < 1)
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN sequence_number SET DEFAULT 1
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN sequence_number SET NOT NULL
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN description SET DEFAULT ''
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN description SET NOT NULL
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN materiality_level SET DEFAULT 'не указан'
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN materiality_level SET NOT NULL
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN indicator SET DEFAULT 'не указан'
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN indicator SET NOT NULL
    """,
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Recommendation fields migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
