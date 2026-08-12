from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.recommendation_access import user_can_manage_recommendation
from app.crud import checks_crud, recommendations_crud
from app.models.recommendations import Recommendation
from app.schemas.recommendations import (
    RecommendationBatchRequest,
    RecommendationCreate,
    RecommendationListResponse,
    RecommendationUpdate,
)
from app.services import attachments_service
from app.services.crud_errors import AccessDeniedError, InvalidReferenceError, ResourceNotFoundError
from app.services.dictionary_validation import validate_recommendation_dictionary_fields


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


async def batch_recommendations(
    session: AsyncSession,
    payload: RecommendationBatchRequest,
) -> RecommendationListResponse:
    check = await checks_crud.get_check_by_serial(session, payload.serial_number)
    if check is None:
        raise InvalidReferenceError("Проверка с указанным ключом не найдена.")

    normalized_items = []
    for item in payload.items:
        data = item.model_dump()
        data["serial_number"] = check.serial_number
        await validate_recommendation_dictionary_fields(
            session,
            {
                "auditor": data.get("auditor"),
                "manager": data.get("manager"),
            },
        )
        normalized_items.append(data)

    try:
        if payload.mode == "replace":
            existing = await recommendations_crud.list_recommendations_for_check(session, check.id)
            for recommendation in existing:
                await attachments_service.delete_attachments_for_entity(
                    session,
                    entity_type="recommendation",
                    entity_id=recommendation.id,
                )
                await recommendations_crud.delete_recommendation_row(session, recommendation)
            next_sequence = 1
        else:
            next_sequence = await recommendations_crud.get_next_sequence_number(session, check.id)

        created = []
        for index, data in enumerate(normalized_items, start=next_sequence):
            created.append(
                await recommendations_crud.add_recommendation_row(
                    session,
                    data,
                    check_id=check.id,
                    sequence_number=index,
                )
            )

        await session.commit()
        for recommendation in created:
            await session.refresh(recommendation)
        return RecommendationListResponse(items=list(created), total=len(created))
    except Exception:
        await session.rollback()
        raise


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


async def delete_recommendation(
    session: AsyncSession,
    recommendation_id: int,
    user: CurrentUser,
) -> None:
    recommendation = await get_recommendation(session, recommendation_id)
    if not user_can_manage_recommendation(
        role=user.role,
        username=user.username,
        auditor=recommendation.auditor,
    ):
        raise AccessDeniedError("Недостаточно прав для удаления этой рекомендации.")
    try:
        await attachments_service.delete_attachments_for_entity(
            session,
            entity_type="recommendation",
            entity_id=recommendation.id,
        )
        await recommendations_crud.delete_recommendation_row(session, recommendation)
        await recommendations_crud.renumber_recommendations_for_check(session, recommendation.check_id)
        await session.commit()
    except Exception:
        await session.rollback()
        raise


async def delete_recommendations_batch(
    session: AsyncSession,
    recommendation_ids: list[int],
    user: CurrentUser,
) -> None:
    unique_ids = list(dict.fromkeys(recommendation_ids))
    recommendations = []
    for recommendation_id in unique_ids:
        recommendation = await get_recommendation(session, recommendation_id)
        if not user_can_manage_recommendation(
            role=user.role,
            username=user.username,
            auditor=recommendation.auditor,
        ):
            raise AccessDeniedError("Недостаточно прав для удаления одной из рекомендаций.")
        recommendations.append(recommendation)

    check_ids: set[int] = set()
    try:
        for recommendation in recommendations:
            await attachments_service.delete_attachments_for_entity(
                session,
                entity_type="recommendation",
                entity_id=recommendation.id,
            )
            await recommendations_crud.delete_recommendation_row(session, recommendation)
            check_ids.add(recommendation.check_id)

        for check_id in check_ids:
            await recommendations_crud.renumber_recommendations_for_check(session, check_id)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

