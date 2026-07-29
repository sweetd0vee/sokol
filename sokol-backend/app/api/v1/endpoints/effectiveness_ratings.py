from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.effectiveness_ratings_crud import (
    count_effectiveness_ratings,
    create_effectiveness_rating,
    delete_effectiveness_rating,
    get_effectiveness_rating,
    list_effectiveness_ratings,
    update_effectiveness_rating,
)
from app.db.session import get_db_session
from app.schemas.effectiveness_ratings import (
    EffectivenessRatingCreate,
    EffectivenessRatingListResponse,
    EffectivenessRatingRead,
    EffectivenessRatingUpdate,
)


router = APIRouter(
    prefix="/settings/effectiveness_ratings", tags=["effectiveness_ratings"]
)


@router.post(
    "",
    response_model=EffectivenessRatingRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_effectiveness_rating_endpoint(
    rating_in: EffectivenessRatingCreate,
    session: AsyncSession = Depends(get_db_session),
) -> EffectivenessRatingRead:
    return await create_effectiveness_rating(session, rating_in)


@router.get("", response_model=EffectivenessRatingListResponse)
async def list_effectiveness_ratings_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, min_length=1),
    session: AsyncSession = Depends(get_db_session),
) -> EffectivenessRatingListResponse:
    items = await list_effectiveness_ratings(
        session, skip=skip, limit=limit, search=search
    )
    total = await count_effectiveness_ratings(session, search=search)
    return EffectivenessRatingListResponse(items=list(items), total=total)


@router.get("/{rating_id}", response_model=EffectivenessRatingRead)
async def get_effectiveness_rating_endpoint(
    rating_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> EffectivenessRatingRead:
    rating = await get_effectiveness_rating(session, rating_id)
    if not rating:
        raise HTTPException(status_code=404, detail="Оценка эффективности не найдена.")
    return rating


@router.patch("/{rating_id}", response_model=EffectivenessRatingRead)
async def update_effectiveness_rating_endpoint(
    rating_id: UUID,
    rating_in: EffectivenessRatingUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> EffectivenessRatingRead:
    rating = await get_effectiveness_rating(session, rating_id)
    if not rating:
        raise HTTPException(status_code=404, detail="Оценка эффективности не найдена.")
    return await update_effectiveness_rating(session, rating, rating_in)


@router.delete("/{rating_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_effectiveness_rating_endpoint(
    rating_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    rating = await get_effectiveness_rating(session, rating_id)
    if not rating:
        raise HTTPException(status_code=404, detail="Оценка эффективности не найдена.")
    await delete_effectiveness_rating(session, rating)
    return None
