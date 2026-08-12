"""Indexes for analytics filter/aggregate columns."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_analytics_indexes

MIGRATION_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_checks_start_date ON checks (start_date)",
    "CREATE INDEX IF NOT EXISTS ix_checks_check_leader ON checks (check_leader)",
    "CREATE INDEX IF NOT EXISTS ix_checks_status ON checks (status)",
    "CREATE INDEX IF NOT EXISTS ix_recommendations_deadline ON recommendations (deadline)",
    "CREATE INDEX IF NOT EXISTS ix_recommendations_auditor ON recommendations (auditor)",
    "CREATE INDEX IF NOT EXISTS ix_recommendations_audit_object ON recommendations (audit_object)",
    "CREATE INDEX IF NOT EXISTS ix_recommendations_status ON recommendations (status)",
    "CREATE INDEX IF NOT EXISTS ix_recommendations_materiality_level ON recommendations (materiality_level)",
    "CREATE INDEX IF NOT EXISTS ix_recommendations_deadline_status ON recommendations (deadline, status)",
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in MIGRATION_STATEMENTS:
            await conn.execute(text(statement))
    print("Analytics indexes migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
