from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select

from app.db.runtime import table_is_nonempty
from app.db.session import AsyncSessionLocal
from app.models.departments import Department
from app.utils.dictionary_text import normalize_dictionary_label


async def seed_departments(
    departments: Sequence[str], *, only_if_empty: bool = False
) -> int:
    if not departments:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        if only_if_empty and await table_is_nonempty(session, Department):
            return 0

        existing = await session.execute(select(Department))
        existing_normalized = {
            normalize_dictionary_label(row.name) for row in existing.scalars()
        }

        for name in departments:
            normalized = normalize_dictionary_label(name)
            if not normalized or normalized in existing_normalized:
                continue
            session.add(Department(name=normalized))
            existing_normalized.add(normalized)
            inserted += 1
        await session.commit()
    return inserted
