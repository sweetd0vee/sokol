from collections.abc import Sequence
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.effectiveness_ratings import EffectivenessRating
from app.schemas.effectiveness_ratings import (
    EffectivenessRatingCreate,
    EffectivenessRatingUpdate,
)


def _apply_filters(query, search: Optional[str] = None):
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(EffectivenessRating.label.ilike(search_term))
    return query


async def create_effectiveness_rating(
    session: AsyncSession, rating_in: EffectivenessRatingCreate
) -> EffectivenessRating:
    rating = EffectivenessRating(**rating_in.model_dump())
    session.add(rating)
    await session.commit()
    await session.refresh(rating)
    return rating


async def get_effectiveness_rating(
    session: AsyncSession, rating_id: UUID
) -> Optional[EffectivenessRating]:
    result = await session.execute(
        select(EffectivenessRating).where(EffectivenessRating.id == rating_id)
    )
    return result.scalar_one_or_none()


async def list_effectiveness_ratings(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[EffectivenessRating]:
    query = select(EffectivenessRating).order_by(
        EffectivenessRating.label.asc(),
        EffectivenessRating.id.asc(),
    )
    query = _apply_filters(query, search=search)
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


async def count_effectiveness_ratings(
    session: AsyncSession, search: Optional[str] = None
) -> int:
    query = select(func.count()).select_from(EffectivenessRating)
    query = _apply_filters(query, search=search)
    result = await session.execute(query)
    return int(result.scalar_one())


async def update_effectiveness_rating(
    session: AsyncSession,
    rating: EffectivenessRating,
    rating_in: EffectivenessRatingUpdate,
) -> EffectivenessRating:
    update_data = rating_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rating, field, value)
    session.add(rating)
    await session.commit()
    await session.refresh(rating)
    return rating


async def delete_effectiveness_rating(
    session: AsyncSession, rating: EffectivenessRating
) -> None:
    await session.delete(rating)
    await session.commit()
