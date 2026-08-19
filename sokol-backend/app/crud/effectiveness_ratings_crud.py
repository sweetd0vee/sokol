from collections.abc import Sequence
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_crud import (
    count_dictionary_items,
    create_dictionary_item,
    delete_dictionary_item,
    get_dictionary_item,
    list_dictionary_items,
    update_dictionary_item,
)
from app.models.effectiveness_ratings import EffectivenessRating
from app.schemas.effectiveness_ratings import (
    EffectivenessRatingCreate,
    EffectivenessRatingUpdate,
)


async def create_effectiveness_rating(
    session: AsyncSession, rating_in: EffectivenessRatingCreate
) -> EffectivenessRating:
    return await create_dictionary_item(
        session,
        EffectivenessRating,
        rating_in.model_dump(),
        label_field="label",
        dictionary_name="effectiveness_ratings",
    )


async def get_effectiveness_rating(
    session: AsyncSession, rating_id: UUID
) -> Optional[EffectivenessRating]:
    return await get_dictionary_item(session, EffectivenessRating, rating_id)


async def list_effectiveness_ratings(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[EffectivenessRating]:
    return await list_dictionary_items(
        session,
        EffectivenessRating,
        order_by=(EffectivenessRating.label.asc(), EffectivenessRating.id.asc()),
        skip=skip,
        limit=limit,
        search=search,
        search_columns=(EffectivenessRating.label,),
    )


async def count_effectiveness_ratings(
    session: AsyncSession, search: Optional[str] = None
) -> int:
    return await count_dictionary_items(
        session,
        EffectivenessRating,
        search=search,
        search_columns=(EffectivenessRating.label,),
    )


async def update_effectiveness_rating(
    session: AsyncSession,
    rating: EffectivenessRating,
    rating_in: EffectivenessRatingUpdate,
) -> EffectivenessRating:
    return await update_dictionary_item(
        session,
        rating,
        rating_in.model_dump(exclude_unset=True),
        label_field="label",
        dictionary_name="effectiveness_ratings",
    )


async def delete_effectiveness_rating(
    session: AsyncSession, rating: EffectivenessRating
) -> None:
    await delete_dictionary_item(session, rating)
