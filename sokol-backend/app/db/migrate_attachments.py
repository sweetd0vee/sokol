"""Создаёт таблицу attachments."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_attachments

MIGRATION_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(32) NOT NULL,
        entity_id INTEGER NOT NULL,
        slot VARCHAR(64) NOT NULL,
        check_serial_number VARCHAR(32) NOT NULL,
        bucket VARCHAR(128) NOT NULL,
        object_key VARCHAR(512) NOT NULL,
        original_name VARCHAR(512) NOT NULL,
        content_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
        size_bytes BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_attachments_entity_type ON attachments (entity_type)",
    "CREATE INDEX IF NOT EXISTS ix_attachments_entity_id ON attachments (entity_id)",
    "CREATE INDEX IF NOT EXISTS ix_attachments_check_serial_number ON attachments (check_serial_number)",
    "CREATE INDEX IF NOT EXISTS ix_attachments_entity_lookup ON attachments (entity_type, entity_id)",
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Attachments migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
