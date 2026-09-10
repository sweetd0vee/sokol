"""Adds execution_deadline and additional_status in_progress."""

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.db.session import engine


async def migrate() -> None:
    conn = await engine.connect()
    try:
        autocommit = await conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            await autocommit.execute(
                text(
                    "ALTER TYPE recommendation_additional_status "
                    "ADD VALUE IF NOT EXISTS 'in_progress'"
                )
            )
        except ProgrammingError:
            # Fresh schema: create_all already built the enum with this value.
            pass
    finally:
        await conn.close()

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE recommendations "
                "ADD COLUMN IF NOT EXISTS execution_deadline DATE"
            )
        )
    print("Recommendation execution_deadline migration completed.")
