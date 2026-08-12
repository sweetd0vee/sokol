from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import checks_crud, recommendations_crud
from app.models.recommendations import Recommendation
from app.schemas.recommendations import (
    RecommendationCreate,
    RecommendationListResponse,
    RecommendationUpdate,
)
from app.services.crud_errors import InvalidReferenceError, ResourceNotFoundError


async def create_recommendation(
    session: AsyncSession,
    recommendation_in: RecommendationCreate,
) -> Recommendation:
    check = await checks_crud.get_check_by_serial(session, recommendation_in.serial_number)
    if check is None:
        raise InvalidReferenceError("Проверка с указанным ключом не найдена.")
    return await recommendations_crud.create_recommendation(
        session,
        recommendation_in,
        check_id=check.id,
    )


async def list_recommendations(
    session: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 200,
    search: Optional[str] = None,
    serial_number: Optional[str] = None,
) -> RecommendationListResponse:
    items = await recommendations_crud.list_recommendations(
        session,
        skip=skip,
        limit=limit,
        search=search,
        serial_number=serial_number,
    )
    total = await recommendations_crud.count_recommendations(
        session,
        search=search,
        serial_number=serial_number,
    )
    return RecommendationListResponse(items=list(items), total=total)


async def get_recommendation(
    session: AsyncSession,
    recommendation_id: int,
) -> Recommendation:
    recommendation = await recommendations_crud.get_recommendation(session, recommendation_id)
    if recommendation is None:
        raise ResourceNotFoundError("Рекомендация не найдена.")
    return recommendation


async def update_recommendation(
    session: AsyncSession,
    recommendation_id: int,
    recommendation_in: RecommendationUpdate,
) -> Recommendation:
    recommendation = await get_recommendation(session, recommendation_id)

    check_id: Optional[int] = None
    if recommendation_in.serial_number:
        check = await checks_crud.get_check_by_serial(session, recommendation_in.serial_number)
        if check is None:
            raise InvalidReferenceError("Проверка с указанным ключом не найдена.")
        check_id = check.id

    return await recommendations_crud.update_recommendation(
        session,
        recommendation,
        recommendation_in,
        check_id=check_id,
    )


async def delete_recommendation(session: AsyncSession, recommendation_id: int) -> None:
    recommendation = await get_recommendation(session, recommendation_id)
    await recommendations_crud.delete_recommendation(session, recommendation)

