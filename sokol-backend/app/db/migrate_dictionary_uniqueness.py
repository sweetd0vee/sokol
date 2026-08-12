"""Normalize dictionary labels, deduplicate rows, and add unique indexes."""

import asyncio
from collections import defaultdict

from sqlalchemy import select, text

from app.db.session import AsyncSessionLocal, engine
from app.models.auditors import Auditor
from app.models.departments import Department
from app.utils.dictionary_text import normalize_dictionary_label

# python -m app.db.migrate_dictionary_uniqueness

UNIQUE_INDEXES = [
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_auditors_full_name ON auditors (full_name)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_name ON departments (name)",
]

AUDITOR_REFERENCE_UPDATES = [
    ("checks", "check_leader"),
    ("recommendations", "auditor"),
]


async def _apply_label_renames(
    session,
    renames: dict[str, str],
    *,
    table: str,
    column: str,
) -> int:
    updated = 0
    for old, new in renames.items():
        if old == new:
            continue
        result = await session.execute(
            text(
                f"UPDATE {table} SET {column} = :new_value WHERE {column} = :old_value"
            ),
            {"new_value": new, "old_value": old},
        )
        updated += int(result.rowcount or 0)
    return updated


async def _dedupe_labels(
    session,
    model,
    label_attr: str,
    *,
    reference_updates: list[tuple[str, str]],
) -> tuple[int, int, int]:
    """Return (renamed_labels, updated_references, removed_duplicates)."""
    result = await session.execute(
        select(model).order_by(getattr(model, label_attr).asc(), model.id.asc())
    )
    rows = list(result.scalars())
    renames: dict[str, str] = {}

    for row in rows:
        raw = str(getattr(row, label_attr))
        normalized = normalize_dictionary_label(raw)
        if raw != normalized:
            renames[raw] = normalized
            setattr(row, label_attr, normalized)

    updated_refs = 0
    for table, column in reference_updates:
        updated_refs += await _apply_label_renames(
            session, renames, table=table, column=column
        )

    await session.flush()

    grouped: dict[str, list] = defaultdict(list)
    for row in rows:
        grouped[str(getattr(row, label_attr))].append(row)

    removed = 0
    for group in grouped.values():
        if len(group) <= 1:
            continue
        for duplicate in group[1:]:
            await session.delete(duplicate)
            removed += 1

    return len(renames), updated_refs, removed


async def migrate() -> None:
    async with AsyncSessionLocal() as session:
        auditor_renamed, auditor_refs, auditor_removed = await _dedupe_labels(
            session,
            Auditor,
            "full_name",
            reference_updates=AUDITOR_REFERENCE_UPDATES,
        )
        dept_renamed, _, dept_removed = await _dedupe_labels(
            session,
            Department,
            "name",
            reference_updates=[],
        )
        await session.commit()
        print(
            "Dictionary dedupe: "
            f"auditors renamed={auditor_renamed}, refs={auditor_refs}, removed={auditor_removed}; "
            f"departments renamed={dept_renamed}, removed={dept_removed}."
        )

    async with engine.begin() as conn:
        for statement in UNIQUE_INDEXES:
            await conn.execute(text(statement))
    print("Dictionary uniqueness migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
