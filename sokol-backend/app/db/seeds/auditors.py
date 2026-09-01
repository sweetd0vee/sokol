from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select

from app.db.catalogs.auditors import AUDITOR_CODES
from app.db.runtime import table_is_nonempty
from app.db.session import AsyncSessionLocal
from app.models.auditors import Auditor
from app.utils.check_key import get_leader_initials_code
from app.utils.dictionary_text import normalize_dictionary_label


async def seed_auditors(
    auditors: Sequence[str], *, only_if_empty: bool = False
) -> int:
    if not auditors:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        if only_if_empty and await table_is_nonempty(session, Auditor):
            return 0

        existing = await session.execute(select(Auditor))
        existing_normalized = {
            normalize_dictionary_label(row.full_name)
            for row in existing.scalars()
        }

        for name in auditors:
            normalized = normalize_dictionary_label(name)
            if not normalized or normalized in existing_normalized:
                continue
            session.add(
                Auditor(
                    full_name=normalized,
                    code=AUDITOR_CODES.get(name, get_leader_initials_code(normalized)),
                )
            )
            existing_normalized.add(normalized)
            inserted += 1
        await session.commit()
    return inserted
