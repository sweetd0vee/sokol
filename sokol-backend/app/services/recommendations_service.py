from typing import Optional

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.current_user import CurrentUser
from app.core.exceptions import InvalidReferenceError, ResourceNotFoundError
from app.core.recommendation_access import ensure_user_can_manage_recommendation
from app.services.db_transaction import rollback_on_error
from app.crud import checks_crud, recommendations_crud
from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.schemas.recommendations import (
    RecommendationBatchRequest,
    RecommendationCreate,
    RecommendationListResponse,
    RecommendationUpdate,
)
from app.services import attachments_service
from app.services.dictionary_integrity import sync_recommendation_audit_objects
from app.services.dictionary_validation import (
    canonicalize_audit_objects,
    validate_recommendation_dictionary_fields,
)
from app.services.recommendation_status import overlay_computed_status_fields, today_moscow

logger = logging.getLogger(__name__)


async def _check_by_serial(session: AsyncSession, serial_number: str) -> Check:
    check = await checks_crud.get_check_by_serial(session, serial_number)
    if check is None:
        raise InvalidReferenceError("Проверка с указанным ключом не найдена.")
    return check


def _assert_can_manage(user: CurrentUser, recommendation: Recommendation, *, message: str) -> None:
    ensure_user_can_manage_recommendation(
        role=user.role,
        username=user.username,
        auditor=recommendation.auditor,
        message=message,
    )


async def _prepare_create_payload(session: AsyncSession, data: dict) -> dict:
    payload = dict(data)
    payload["audit_object"] = await canonicalize_audit_objects(session, payload.get("audit_object"))
    await validate_recommendation_dictionary_fields(
        session,
        {"auditor": payload.get("auditor")},
    )
    if not payload.get("created_at"):
        payload["created_at"] = today_moscow()
    return overlay_computed_status_fields(payload)


async def _insert_recommendation(
    session: AsyncSession,
    data: dict,
    *,
    check_id: int,
    sequence_number: int,
) -> Recommendation:
    recommendation = await recommendations_crud.add_recommendation_row(
        session,
        data,
        check_id=check_id,
        sequence_number=sequence_number,
    )
    await sync_recommendation_audit_objects(
        session,
        recommendation.id,
        recommendation.audit_object,
    )
    return recommendation


async def _delete_recommendation_and_files(
    session: AsyncSession,
    recommendation: Recommendation,
) -> None:
    await attachments_service.delete_attachments_for_entity(
        session,
        entity_type="recommendation",
        entity_id=recommendation.id,
    )
    await recommendations_crud.delete_recommendation_row(session, recommendation)


async def create_recommendation(
    session: AsyncSession,
    recommendation_in: RecommendationCreate,
) -> Recommendation:
    check = await _check_by_serial(session, recommendation_in.serial_number)
    data = await _prepare_create_payload(session, recommendation_in.model_dump())
    async with rollback_on_error(
        session,
        logger=logger,
        message="Failed to create recommendation for check %s",
        message_args=(check.serial_number,),
    ):
        recommendation = await _insert_recommendation(
            session,
            data,
            check_id=check.id,
            sequence_number=await recommendations_crud.get_next_sequence_number(session, check.id),
        )
        await session.commit()
        await session.refresh(recommendation)
        return recommendation


async def batch_recommendations(
    session: AsyncSession,
    payload: RecommendationBatchRequest,
) -> RecommendationListResponse:
    check = await _check_by_serial(session, payload.serial_number)

    normalized_items = []
    for item in payload.items:
        data = await _prepare_create_payload(session, item.model_dump())
        data["serial_number"] = check.serial_number
        normalized_items.append(data)

    async with rollback_on_error(
        session,
        logger=logger,
        message="Failed to batch recommendations for check %s",
        message_args=(check.serial_number,),
    ):
        if payload.mode == "replace":
            existing = await recommendations_crud.list_recommendations_for_check(session, check.id)
            for recommendation in existing:
                await _delete_recommendation_and_files(session, recommendation)
            next_sequence = 1
        else:
            next_sequence = await recommendations_crud.get_next_sequence_number(session, check.id)

        created = []
        for index, data in enumerate(normalized_items, start=next_sequence):
            created.append(
                await _insert_recommendation(
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
        check = await _check_by_serial(session, recommendation_in.serial_number)
        check_id = check.id

    update_data = overlay_computed_status_fields(
        recommendation_in.model_dump(exclude_unset=True),
        existing=recommendation,
    )
    if "audit_object" in update_data:
        update_data["audit_object"] = await canonicalize_audit_objects(
            session,
            update_data.get("audit_object"),
        )
    await validate_recommendation_dictionary_fields(
        session,
        {key: update_data[key] for key in ("auditor",) if key in update_data},
    )
    previous_check_id = recommendation.check_id

    async with rollback_on_error(
        session,
        logger=logger,
        message="Failed to update recommendation %s",
        message_args=(recommendation_id,),
    ):
        if check_id is not None:
            update_data["check_id"] = check_id
        await recommendations_crud.update_recommendation_fields(
            session,
            recommendation,
            update_data,
        )
        if "audit_object" in update_data:
            await sync_recommendation_audit_objects(
                session,
                recommendation.id,
                recommendation.audit_object,
            )

        if check_id is not None and check_id != previous_check_id:
            await recommendations_crud.renumber_recommendations_for_check(session, previous_check_id)
            recommendation.sequence_number = await recommendations_crud.get_next_sequence_number(
                session, check_id
            )
            session.add(recommendation)
            await session.flush()

        await session.commit()
        await session.refresh(recommendation)
        return recommendation


async def delete_recommendation(
    session: AsyncSession,
    recommendation_id: int,
    user: CurrentUser,
) -> None:
    recommendation = await get_recommendation(session, recommendation_id)
    _assert_can_manage(
        user,
        recommendation,
        message="Недостаточно прав для удаления этой рекомендации.",
    )
    async with rollback_on_error(
        session,
        logger=logger,
        message="Failed to delete recommendation %s",
        message_args=(recommendation_id,),
    ):
        await _delete_recommendation_and_files(session, recommendation)
        await recommendations_crud.renumber_recommendations_for_check(session, recommendation.check_id)
        await session.commit()


async def delete_recommendations_batch(
    session: AsyncSession,
    recommendation_ids: list[int],
    user: CurrentUser,
) -> None:
    unique_ids = list(dict.fromkeys(recommendation_ids))
    recommendations = []
    for recommendation_id in unique_ids:
        recommendation = await get_recommendation(session, recommendation_id)
        _assert_can_manage(
            user,
            recommendation,
            message="Недостаточно прав для удаления одной из рекомендаций.",
        )
        recommendations.append(recommendation)

    check_ids: set[int] = set()
    async with rollback_on_error(
        session,
        logger=logger,
        message="Failed to batch-delete %s recommendations",
        message_args=(len(unique_ids),),
    ):
        for recommendation in recommendations:
            await _delete_recommendation_and_files(session, recommendation)
            check_ids.add(recommendation.check_id)

        for check_id in check_ids:
            await recommendations_crud.renumber_recommendations_for_check(session, check_id)
        await session.commit()
