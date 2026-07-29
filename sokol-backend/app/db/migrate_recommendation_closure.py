"""Добавляет поля информации о закрытии в recommendations."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_closure

MIGRATION_STATEMENTS = [
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS actual_completion_date DATE",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_1_reason VARCHAR(64)",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_1_date DATE",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_1_comment TEXT",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_2_reason VARCHAR(64)",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_2_comment TEXT",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS remove_from_control_reason VARCHAR(64)",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS remove_from_control_date DATE",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS remove_from_control_comment TEXT",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS closure_verification_status VARCHAR(64)",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS closure_information TEXT",
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Recommendation closure fields migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
