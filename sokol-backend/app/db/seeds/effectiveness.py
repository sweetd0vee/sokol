from __future__ import annotations

from collections.abc import Sequence

from app.db.seeds.label_rows import seed_exact_label_rows
from app.models.effectiveness_ratings import EffectivenessRating


async def seed_effectiveness_ratings(ratings: Sequence[str]) -> int:
    return await seed_exact_label_rows(EffectivenessRating, ratings)
