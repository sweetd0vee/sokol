from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.check_kinds import CheckKind


async def seed_check_kinds(kinds: Sequence[str]) -> int:
    if not kinds:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        for label in kinds:
            label = label.strip()
            if not label:
                continue
            result = await session.execute(
                select(CheckKind).where(CheckKind.label == label)
            )
            if result.scalar_one_or_none():
                continue
            session.add(CheckKind(label=label))
            inserted += 1
        await session.commit()
    return inserted
