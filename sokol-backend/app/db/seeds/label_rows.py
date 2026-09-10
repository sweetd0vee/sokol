"""Insert dictionary rows that do not already exist (exact match after strip)."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import DeclarativeBase

from app.db.session import AsyncSessionLocal


async def seed_exact_label_rows(
    model: type[DeclarativeBase],
    labels: Sequence[str],
    *,
    attr: str = "label",
) -> int:
    if not labels:
        return 0
    inserted = 0
    column = getattr(model, attr)
    async with AsyncSessionLocal() as session:
        for label in labels:
            label = label.strip()
            if not label:
                continue
            result = await session.execute(select(model).where(column == label))
            if result.scalar_one_or_none():
                continue
            session.add(model(**{attr: label}))
            inserted += 1
        await session.commit()
    return inserted
