"""Adds the required calendar quarter used in check serial numbers."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_check_quarter

MIGRATION_STATEMENTS = [
    "ALTER TABLE checks ADD COLUMN IF NOT EXISTS check_quarter INTEGER",
    """
    UPDATE checks
    SET check_quarter = EXTRACT(QUARTER FROM start_date)::INTEGER
    WHERE check_quarter IS NULL
    """,
    "ALTER TABLE checks ALTER COLUMN check_quarter SET NOT NULL",
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'ck_checks_check_quarter'
              AND conrelid = 'checks'::regclass
        ) THEN
            ALTER TABLE checks
            ADD CONSTRAINT ck_checks_check_quarter
            CHECK (check_quarter BETWEEN 1 AND 4);
        END IF;
    END $$;
    """,
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Check quarter migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
