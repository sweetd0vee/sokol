"""Ad-hoc schema/data patches run until Alembic is adopted.

SQL-only patches live in ``patches``; data backfills stay in dedicated modules.
CLI: ``python -m app.db.migrations --list|--bootstrap|--all|NAME``.
``run_bootstrap_migrations`` is the ordered subset used by Docker entrypoint.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from app.db.migrations.auditor_codes import migrate as migrate_auditor_codes
from app.db.migrations.dictionary_foreign_keys import migrate as migrate_dictionary_foreign_keys
from app.db.migrations.dictionary_uniqueness import migrate as migrate_dictionary_uniqueness
from app.db.migrations.recommendation_audit_object_canonical import (
    migrate as migrate_recommendation_audit_object_canonical,
)
from app.db.migrations.recommendation_execution_deadline import (
    migrate as migrate_recommendation_execution_deadline,
)
from app.db.migrations.patches import (
    ANALYTICS_INDEXES,
    ATTACHMENTS,
    CHECK_EFFECTIVENESS,
    CHECK_QUARTER,
    CHECK_SHORT_NAME,
    MATERIALITY_REQUIRED,
    RECOMMENDATION_ADDITIONAL_INDICATOR,
    RECOMMENDATION_AUDIT_OBJECT_ARRAY,
    RECOMMENDATION_CLOSURE,
    RECOMMENDATION_CLOSURE_LISTS,
    RECOMMENDATION_FIELDS,
    RECOMMENDATION_INDICATOR_ON_CONTROL,
    RECOMMENDATION_INDICATORS,
    RECOMMENDATION_OBSERVATION_NAME,
    RECOMMENDATION_STATUSES,
)

MigrateFn = Callable[[], Awaitable[None]]


@dataclass(frozen=True)
class SchemaMigration:
    name: str
    migrate: MigrateFn
    in_bootstrap: bool = False
    rewrites_data: bool = False


ALL_MIGRATIONS: tuple[SchemaMigration, ...] = (
    SchemaMigration("auditor_codes", migrate_auditor_codes, in_bootstrap=True),
    SchemaMigration("check_quarter", CHECK_QUARTER.migrate, in_bootstrap=True),
    SchemaMigration("check_effectiveness", CHECK_EFFECTIVENESS.migrate, in_bootstrap=True),
    SchemaMigration("attachments", ATTACHMENTS.migrate, in_bootstrap=True),
    SchemaMigration("dictionary_uniqueness", migrate_dictionary_uniqueness, in_bootstrap=True),
    SchemaMigration(
        "recommendation_execution_deadline",
        migrate_recommendation_execution_deadline,
        in_bootstrap=True,
    ),
    SchemaMigration("dictionary_foreign_keys", migrate_dictionary_foreign_keys, in_bootstrap=True),
    SchemaMigration(
        "recommendation_observation_name",
        RECOMMENDATION_OBSERVATION_NAME.migrate,
        in_bootstrap=True,
    ),
    SchemaMigration(
        "recommendation_indicator_on_control",
        RECOMMENDATION_INDICATOR_ON_CONTROL.migrate,
        in_bootstrap=True,
    ),
    SchemaMigration(
        "recommendation_additional_indicator",
        RECOMMENDATION_ADDITIONAL_INDICATOR.migrate,
        in_bootstrap=True,
    ),
    SchemaMigration("analytics_indexes", ANALYTICS_INDEXES.migrate, in_bootstrap=True),
    SchemaMigration("check_short_name", CHECK_SHORT_NAME.migrate),
    SchemaMigration("recommendation_fields", RECOMMENDATION_FIELDS.migrate),
    SchemaMigration("recommendation_closure", RECOMMENDATION_CLOSURE.migrate),
    SchemaMigration("recommendation_closure_lists", RECOMMENDATION_CLOSURE_LISTS.migrate),
    SchemaMigration("recommendation_audit_object_array", RECOMMENDATION_AUDIT_OBJECT_ARRAY.migrate),
    SchemaMigration(
        "recommendation_audit_object_canonical",
        migrate_recommendation_audit_object_canonical,
    ),
    SchemaMigration("recommendation_statuses", RECOMMENDATION_STATUSES.migrate),
    SchemaMigration("materiality_required", MATERIALITY_REQUIRED.migrate),
    SchemaMigration(
        "recommendation_indicators",
        RECOMMENDATION_INDICATORS.migrate,
        rewrites_data=True,
    ),
)

BOOTSTRAP_MIGRATIONS: tuple[MigrateFn, ...] = tuple(
    item.migrate for item in ALL_MIGRATIONS if item.in_bootstrap
)

_BY_NAME = {item.name: item for item in ALL_MIGRATIONS}
if len(_BY_NAME) != len(ALL_MIGRATIONS):
    raise RuntimeError("Duplicate migration names in ALL_MIGRATIONS")


def get_migration(name: str) -> SchemaMigration:
    try:
        return _BY_NAME[name]
    except KeyError as exc:
        known = ", ".join(item.name for item in ALL_MIGRATIONS)
        raise KeyError(f"Unknown migration {name!r}. Available: {known}") from exc


async def run_bootstrap_migrations() -> None:
    for migrate in BOOTSTRAP_MIGRATIONS:
        await migrate()


async def run_named_migration(name: str) -> None:
    await get_migration(name).migrate()


async def run_all_migrations(*, include_destructive: bool = False) -> None:
    for item in ALL_MIGRATIONS:
        if item.rewrites_data and not include_destructive:
            continue
        await item.migrate()
