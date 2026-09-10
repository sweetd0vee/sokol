"""Adds execution_deadline and additional_status in_progress."""

from sqlalchemy import text

from app.db.session import engine


async def migrate() -> None:
    async with engine.connect() as conn:
        autocommit = await conn.execution_options(isolation_level="AUTOCOMMIT")
        await autocommit.execute(
            text(
                "ALTER TYPE recommendation_additional_status "
                "ADD VALUE IF NOT EXISTS 'in_progress'"
            )
        )
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE recommendations "
                "ADD COLUMN IF NOT EXISTS execution_deadline DATE"
            )
        )
    print("Recommendation execution_deadline migration completed.")
