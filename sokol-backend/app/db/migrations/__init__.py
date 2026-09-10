"""Ad-hoc schema/data patches run until Alembic is adopted.

SQL-only patches live in ``patches``; data backfills stay in dedicated modules.
``run_bootstrap_migrations`` is the ordered subset used by Docker entrypoint.
"""

from collections.abc import Awaitable, Callable

from app.db.migrations.auditor_codes import migrate as migrate_auditor_codes
from app.db.migrations.dictionary_foreign_keys import migrate as migrate_dictionary_foreign_keys
from app.db.migrations.dictionary_uniqueness import migrate as migrate_dictionary_uniqueness
from app.db.migrations.recommendation_execution_deadline import (
    migrate as migrate_recommendation_execution_deadline,
)
from app.db.migrations.patches import (
    ANALYTICS_INDEXES,
    ATTACHMENTS,
    CHECK_EFFECTIVENESS,
    CHECK_QUARTER,
    RECOMMENDATION_ADDITIONAL_INDICATOR,
    RECOMMENDATION_INDICATOR_ON_CONTROL,
    RECOMMENDATION_OBSERVATION_NAME,
)

MigrateFn = Callable[[], Awaitable[None]]

BOOTSTRAP_MIGRATIONS: tuple[MigrateFn, ...] = (
    migrate_auditor_codes,
    CHECK_QUARTER.migrate,
    CHECK_EFFECTIVENESS.migrate,
    ATTACHMENTS.migrate,
    migrate_dictionary_uniqueness,
    migrate_dictionary_foreign_keys,
    RECOMMENDATION_OBSERVATION_NAME.migrate,
    RECOMMENDATION_INDICATOR_ON_CONTROL.migrate,
    RECOMMENDATION_ADDITIONAL_INDICATOR.migrate,
    ANALYTICS_INDEXES.migrate,
    migrate_recommendation_execution_deadline,
)


async def run_bootstrap_migrations() -> None:
    for migrate in BOOTSTRAP_MIGRATIONS:
        await migrate()
