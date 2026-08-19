"""Add FK constraints from domain string fields to settings dictionaries."""

from __future__ import annotations

import asyncio

from sqlalchemy import select, text

from app.db.ensure_dictionary_refs import (
    ensure_auditor_names,
    ensure_check_kind_labels,
    ensure_department_names,
    ensure_effectiveness_labels,
)
from app.db.session import AsyncSessionLocal, engine
from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.services.analytics.common import parse_audit_object_parts
from app.services.dictionary_integrity import ensure_unspecified_department
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT

# python -m app.db.migrate_dictionary_foreign_keys

UNIQUE_INDEXES = [
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_check_kinds_label ON check_kinds (label)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_effectiveness_ratings_label ON effectiveness_ratings (label)",
]

WIDEN_COLUMNS = [
    "ALTER TABLE checks ALTER COLUMN check_view TYPE VARCHAR(255)",
    "ALTER TABLE checks ALTER COLUMN process_effectiveness TYPE VARCHAR(255)",
    "ALTER TABLE checks ALTER COLUMN svk_effectiveness TYPE VARCHAR(255)",
    "ALTER TABLE checks ALTER COLUMN sur_effectiveness TYPE VARCHAR(255)",
    "ALTER TABLE checks ALTER COLUMN svik_effectiveness TYPE VARCHAR(255)",
]

NULL_EMPTY_EFFECTIVENESS = [
    """
    UPDATE checks SET process_effectiveness = NULL
    WHERE process_effectiveness IS NOT NULL AND btrim(process_effectiveness) = ''
    """,
    """
    UPDATE checks SET svk_effectiveness = NULL
    WHERE svk_effectiveness IS NOT NULL AND btrim(svk_effectiveness) = ''
    """,
    """
    UPDATE checks SET sur_effectiveness = NULL
    WHERE sur_effectiveness IS NOT NULL AND btrim(sur_effectiveness) = ''
    """,
    """
    UPDATE checks SET svik_effectiveness = NULL
    WHERE svik_effectiveness IS NOT NULL AND btrim(svik_effectiveness) = ''
    """,
]

CREATE_JUNCTION = """
CREATE TABLE IF NOT EXISTS recommendation_audit_objects (
    recommendation_id INTEGER NOT NULL,
    department_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (recommendation_id, department_name)
)
"""

JUNCTION_INDEX = (
    "CREATE INDEX IF NOT EXISTS ix_recommendation_audit_objects_department_name "
    "ON recommendation_audit_objects (department_name)"
)

FOREIGN_KEYS = [
    (
        "fk_checks_check_leader",
        "checks",
        "FOREIGN KEY (check_leader) REFERENCES auditors(full_name) "
        "ON UPDATE CASCADE ON DELETE RESTRICT",
    ),
    (
        "fk_checks_check_view",
        "checks",
        "FOREIGN KEY (check_view) REFERENCES check_kinds(label) "
        "ON UPDATE CASCADE ON DELETE RESTRICT",
    ),
    (
        "fk_checks_process_effectiveness",
        "checks",
        "FOREIGN KEY (process_effectiveness) REFERENCES effectiveness_ratings(label) "
        "ON UPDATE CASCADE ON DELETE SET NULL",
    ),
    (
        "fk_checks_svk_effectiveness",
        "checks",
        "FOREIGN KEY (svk_effectiveness) REFERENCES effectiveness_ratings(label) "
        "ON UPDATE CASCADE ON DELETE SET NULL",
    ),
    (
        "fk_checks_sur_effectiveness",
        "checks",
        "FOREIGN KEY (sur_effectiveness) REFERENCES effectiveness_ratings(label) "
        "ON UPDATE CASCADE ON DELETE SET NULL",
    ),
    (
        "fk_checks_svik_effectiveness",
        "checks",
        "FOREIGN KEY (svik_effectiveness) REFERENCES effectiveness_ratings(label) "
        "ON UPDATE CASCADE ON DELETE SET NULL",
    ),
    (
        "fk_recommendations_auditor",
        "recommendations",
        "FOREIGN KEY (auditor) REFERENCES auditors(full_name) "
        "ON UPDATE CASCADE ON DELETE RESTRICT",
    ),
    (
        "fk_recommendation_audit_objects_recommendation",
        "recommendation_audit_objects",
        "FOREIGN KEY (recommendation_id) REFERENCES recommendations(id) ON DELETE CASCADE",
    ),
    (
        "fk_recommendation_audit_objects_department",
        "recommendation_audit_objects",
        "FOREIGN KEY (department_name) REFERENCES departments(name) "
        "ON UPDATE CASCADE ON DELETE RESTRICT",
    ),
]


async def _constraint_exists(conn, name: str) -> bool:
    result = await conn.scalar(
        text("SELECT 1 FROM pg_constraint WHERE conname = :name"),
        {"name": name},
    )
    return result is not None


async def _add_foreign_keys(conn) -> int:
    added = 0
    for name, table, definition in FOREIGN_KEYS:
        if await _constraint_exists(conn, name):
            continue
        await conn.execute(text(f"ALTER TABLE {table} ADD CONSTRAINT {name} {definition}"))
        added += 1
    return added


async def _collect_domain_labels(session) -> tuple[set[str], set[str], set[str], set[str]]:
    auditors: set[str] = set()
    views: set[str] = set()
    ratings: set[str] = set()
    departments: set[str] = {UNSPECIFIED_AUDIT_OBJECT}

    checks = (await session.execute(select(Check))).scalars().all()
    for check in checks:
        if check.check_leader:
            auditors.add(check.check_leader)
        if check.check_view:
            views.add(check.check_view)
        for value in (
            check.process_effectiveness,
            check.svk_effectiveness,
            check.sur_effectiveness,
            check.svik_effectiveness,
        ):
            if value and str(value).strip():
                ratings.add(str(value).strip())

    recommendations = (await session.execute(select(Recommendation))).scalars().all()
    for recommendation in recommendations:
        if recommendation.auditor:
            auditors.add(recommendation.auditor)
        for part in parse_audit_object_parts(recommendation.audit_object):
            departments.add(part)
    return auditors, views, ratings, departments


async def _backfill_junction(conn) -> int:
    await conn.execute(
        text(
            """
            UPDATE recommendations
            SET audit_object = ARRAY[:unspecified]::TEXT[]
            WHERE audit_object IS NULL OR cardinality(audit_object) = 0
            """
        ),
        {"unspecified": UNSPECIFIED_AUDIT_OBJECT},
    )
    result = await conn.execute(
        text(
            """
            INSERT INTO recommendation_audit_objects (recommendation_id, department_name)
            SELECT DISTINCT r.id, btrim(part)
            FROM recommendations r
            CROSS JOIN LATERAL unnest(r.audit_object) AS part
            WHERE btrim(part) <> ''
            ON CONFLICT DO NOTHING
            """
        )
    )
    return int(result.rowcount or 0)


async def migrate() -> None:
    async with engine.begin() as conn:
        for statement in WIDEN_COLUMNS:
            await conn.execute(text(statement))
        for statement in NULL_EMPTY_EFFECTIVENESS:
            await conn.execute(text(statement))
        await conn.execute(
            text(
                "DELETE FROM check_kinds a USING check_kinds b "
                "WHERE a.label = b.label AND a.id > b.id"
            )
        )
        await conn.execute(
            text(
                "DELETE FROM effectiveness_ratings a USING effectiveness_ratings b "
                "WHERE a.label = b.label AND a.id > b.id"
            )
        )
        for statement in UNIQUE_INDEXES:
            await conn.execute(text(statement))
        await conn.execute(text(CREATE_JUNCTION))
        await conn.execute(text(JUNCTION_INDEX))

    async with AsyncSessionLocal() as session:
        await ensure_unspecified_department(session)
        auditors, views, ratings, departments = await _collect_domain_labels(session)
        inserted = {
            "auditors": await ensure_auditor_names(session, auditors),
            "check_kinds": await ensure_check_kind_labels(session, views),
            "effectiveness_ratings": await ensure_effectiveness_labels(session, ratings),
            "departments": await ensure_department_names(session, departments),
        }
        await session.commit()

    async with engine.begin() as conn:
        linked = await _backfill_junction(conn)
        added_fks = await _add_foreign_keys(conn)

    print(
        "Dictionary FK migration completed: "
        f"inserted={inserted}, junction_rows={linked}, fks_added={added_fks}."
    )


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
