from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.checks_crud import get_check_by_serial
from app.crud.recommendations_crud import (
    count_recommendations,
    create_recommendation,
    delete_recommendation,
    get_recommendation,
    list_recommendations,
    update_recommendation,
)
from app.db.session import get_db_session
from app.schemas.recommendations import (
    RecommendationCreate,
    RecommendationListResponse,
    RecommendationRead,
    RecommendationUpdate,
)
from app.services.dictionary_validation import DictionaryRefError

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("", response_model=RecommendationRead, status_code=status.HTTP_201_CREATED)
async def create_recommendation_endpoint(
    recommendation_in: RecommendationCreate,
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationRead:
    check = await get_check_by_serial(session, recommendation_in.serial_number)
    if not check:
        raise HTTPException(status_code=400, detail="Проверка с указанным ключом не найдена.")
    try:
        return await create_recommendation(session, recommendation_in, check_id=check.id)
    except DictionaryRefError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=RecommendationListResponse)
async def list_recommendations_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    search: Optional[str] = Query(None, min_length=1),
    serial_number: Optional[str] = Query(None, min_length=1),
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationListResponse:
    items = await list_recommendations(
        session,
        skip=skip,
        limit=limit,
        search=search,
        serial_number=serial_number,
    )
    total = await count_recommendations(
        session,
        search=search,
        serial_number=serial_number,
    )
    return RecommendationListResponse(items=list(items), total=total)


@router.get("/{recommendation_id}", response_model=RecommendationRead)
async def get_recommendation_endpoint(
    recommendation_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationRead:
    recommendation = await get_recommendation(session, recommendation_id)
    if not recommendation:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена.")
    return recommendation


@router.patch("/{recommendation_id}", response_model=RecommendationRead)
async def update_recommendation_endpoint(
    recommendation_id: int,
    recommendation_in: RecommendationUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationRead:
    recommendation = await get_recommendation(session, recommendation_id)
    if not recommendation:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена.")

    check_id: Optional[int] = None
    if recommendation_in.serial_number:
        check = await get_check_by_serial(session, recommendation_in.serial_number)
        if not check:
            raise HTTPException(status_code=400, detail="Проверка с указанным ключом не найдена.")
        check_id = check.id

    try:
        return await update_recommendation(
            session,
            recommendation,
            recommendation_in,
            check_id=check_id,
        )
    except DictionaryRefError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{recommendation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recommendation_endpoint(
    recommendation_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    recommendation = await get_recommendation(session, recommendation_id)
    if not recommendation:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена.")
    await delete_recommendation(session, recommendation)
    return None
