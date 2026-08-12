from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.api.deps import require_admin
from app.schemas.recommendations import (
    RecommendationCreate,
    RecommendationListResponse,
    RecommendationRead,
    RecommendationUpdate,
)
from app.services import recommendations_service
from app.services.crud_errors import InvalidReferenceError, ResourceNotFoundError
from app.services.dictionary_validation import DictionaryRefError

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("", response_model=RecommendationRead, status_code=status.HTTP_201_CREATED)
async def create_recommendation_endpoint(
    recommendation_in: RecommendationCreate,
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationRead:
    try:
        return await recommendations_service.create_recommendation(session, recommendation_in)
    except InvalidReferenceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
    return await recommendations_service.list_recommendations(
        session,
        skip=skip,
        limit=limit,
        search=search,
        serial_number=serial_number,
    )


@router.get("/{recommendation_id}", response_model=RecommendationRead)
async def get_recommendation_endpoint(
    recommendation_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationRead:
    try:
        return await recommendations_service.get_recommendation(session, recommendation_id)
    except ResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{recommendation_id}", response_model=RecommendationRead)
async def update_recommendation_endpoint(
    recommendation_id: int,
    recommendation_in: RecommendationUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationRead:
    try:
        return await recommendations_service.update_recommendation(
            session,
            recommendation_id,
            recommendation_in,
        )
    except ResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidReferenceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DictionaryRefError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{recommendation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recommendation_endpoint(
    recommendation_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> None:
    try:
        await recommendations_service.delete_recommendation(session, recommendation_id)
    except ResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return None
