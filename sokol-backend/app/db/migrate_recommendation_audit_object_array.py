"""Converts recommendation audit_object from text value to text array."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_audit_object_array

MIGRATION_STATEMENTS = [
    "DROP INDEX IF EXISTS ix_recommendations_audit_object",
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'recommendations'
              AND column_name = 'audit_object'
              AND data_type <> 'ARRAY'
        ) THEN
            ALTER TABLE recommendations
            ALTER COLUMN audit_object TYPE TEXT[]
            USING CASE
                WHEN audit_object IS NULL OR btrim(audit_object::text) = ''
                    THEN ARRAY['Не указан']::TEXT[]
                ELSE regexp_split_to_array(audit_object::text, '\\s*[,;]\\s*')::TEXT[]
            END;
        END IF;

        UPDATE recommendations
        SET audit_object = ARRAY['Не указан']::TEXT[]
        WHERE audit_object IS NULL OR array_length(audit_object, 1) IS NULL;

        ALTER TABLE recommendations
        ALTER COLUMN audit_object SET DEFAULT ARRAY['Не указан']::TEXT[];

        ALTER TABLE recommendations
        ALTER COLUMN audit_object SET NOT NULL;
    END $$;
    """,
    "CREATE INDEX IF NOT EXISTS ix_recommendations_audit_object_gin ON recommendations USING GIN (audit_object)",
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Recommendation audit_object array migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
