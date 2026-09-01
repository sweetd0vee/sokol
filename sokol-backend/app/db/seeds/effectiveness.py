from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.effectiveness_ratings import EffectivenessRating


async def seed_effectiveness_ratings(ratings: Sequence[str]) -> int:
    if not ratings:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        for label in ratings:
            label = label.strip()
            if not label:
                continue
            result = await session.execute(
                select(EffectivenessRating).where(EffectivenessRating.label == label)
            )
            if result.scalar_one_or_none():
                continue
            session.add(EffectivenessRating(label=label))
            inserted += 1
        await session.commit()
    return inserted
