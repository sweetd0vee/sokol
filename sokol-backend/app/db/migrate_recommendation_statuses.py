"""Обновляет enum статуса и доп. статуса рекомендаций."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_statuses

STATEMENTS = [
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'recommendation_status_new'
      ) THEN
        CREATE TYPE recommendation_status_new AS ENUM (
          'completed',
          'unresolved',
          'on_control',
          'in_progress'
        );
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'recommendation_additional_status_new'
      ) THEN
        CREATE TYPE recommendation_additional_status_new AS ENUM (
          'on_time',
          'deadline_violated',
          'on_control'
        );
      END IF;
    END $$;
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN status TYPE recommendation_status_new
    USING (
      CASE status::text
        WHEN 'completed' THEN 'completed'
        WHEN 'COMPLETED' THEN 'completed'
        WHEN 'overdue' THEN 'unresolved'
        WHEN 'OVERDUE' THEN 'unresolved'
        WHEN 'unresolved' THEN 'unresolved'
        WHEN 'UNRESOLVED' THEN 'unresolved'
        WHEN 'not_started' THEN 'on_control'
        WHEN 'NOT_STARTED' THEN 'on_control'
        WHEN 'on_control' THEN 'on_control'
        WHEN 'ON_CONTROL' THEN 'on_control'
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'IN_PROGRESS' THEN 'in_progress'
        ELSE 'on_control'
      END
    )::recommendation_status_new
    """,
    """
    ALTER TABLE recommendations
    ALTER COLUMN additional_status TYPE recommendation_additional_status_new
    USING (
      CASE additional_status::text
        WHEN 'on_time' THEN 'on_time'
        WHEN 'ON_TIME' THEN 'on_time'
        WHEN 'deadline_violated' THEN 'deadline_violated'
        WHEN 'DEADLINE_VIOLATED' THEN 'deadline_violated'
        WHEN 'on_control' THEN 'on_control'
        WHEN 'ON_CONTROL' THEN 'on_control'
        WHEN 'pending_review' THEN 'on_control'
        WHEN 'PENDING_REVIEW' THEN 'on_control'
        WHEN 'removed_control' THEN 'on_time'
        WHEN 'REMOVED_CONTROL' THEN 'on_time'
        WHEN 'none' THEN 'on_time'
        WHEN 'NONE' THEN 'on_time'
        ELSE 'on_control'
      END
    )::recommendation_additional_status_new
    """,
    """
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendation_status') THEN
        DROP TYPE recommendation_status;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendation_additional_status') THEN
        DROP TYPE recommendation_additional_status;
      END IF;
    END $$;
    """,
    """
    ALTER TYPE recommendation_status_new RENAME TO recommendation_status
    """,
    """
    ALTER TYPE recommendation_additional_status_new RENAME TO recommendation_additional_status
    """,
]


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in STATEMENTS:
            await conn.execute(text(statement))
    print(
        "recommendation status enums updated: "
        "completed/unresolved/on_control/in_progress; "
        "on_time/deadline_violated/on_control"
    )


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
