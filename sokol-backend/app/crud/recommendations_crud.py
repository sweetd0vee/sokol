from datetime import date
from typing import Optional, Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recommendations import Recommendation
from app.schemas.recommendations import RecommendationCreate, RecommendationUpdate
from app.services.dictionary_integrity import sync_recommendation_audit_objects
from app.services.dictionary_validation import (
    canonicalize_audit_objects,
    validate_recommendation_dictionary_fields,
)


def _apply_filters(
    query,
    search: Optional[str] = None,
    serial_number: Optional[str] = None,
):
    if serial_number:
        query = query.where(Recommendation.serial_number == serial_number)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Recommendation.name.ilike(search_term),
                Recommendation.observation_name.ilike(search_term),
                Recommendation.description.ilike(search_term),
                func.array_to_string(Recommendation.audit_object, "; ").ilike(search_term),
                Recommendation.auditor.ilike(search_term),
                Recommendation.manager.ilike(search_term),
                Recommendation.serial_number.ilike(search_term),
            )
        )
    return query


async def get_next_sequence_number(session: AsyncSession, check_id: int) -> int:
    result = await session.execute(
        select(func.coalesce(func.max(Recommendation.sequence_number), 0)).where(
            Recommendation.check_id == check_id
        )
    )
    return int(result.scalar_one()) + 1


async def renumber_recommendations_for_check(session: AsyncSession, check_id: int) -> None:
    result = await session.execute(
        select(Recommendation)
        .where(Recommendation.check_id == check_id)
        .order_by(Recommendation.sequence_number, Recommendation.id)
    )
    items = result.scalars().all()
    for index, item in enumerate(items, start=1):
        item.sequence_number = index
    session.add_all(items)


async def list_recommendations_for_check(
    session: AsyncSession,
    check_id: int,
) -> Sequence[Recommendation]:
    result = await session.execute(
        select(Recommendation)
        .where(Recommendation.check_id == check_id)
        .order_by(Recommendation.sequence_number, Recommendation.id)
    )
    return result.scalars().all()


async def add_recommendation_row(
    session: AsyncSession,
    data: dict,
    *,
    check_id: int,
    sequence_number: int,
) -> Recommendation:
    payload = dict(data)
    if not payload.get("created_at"):
        payload["created_at"] = date.today()
    payload["sequence_number"] = sequence_number
    recommendation = Recommendation(
        check_id=check_id,
        **payload,
    )
    session.add(recommendation)
    await session.flush()
    await sync_recommendation_audit_objects(
        session,
        recommendation.id,
        recommendation.audit_object,
    )
    return recommendation


async def delete_recommendation_row(
    session: AsyncSession,
    recommendation: Recommendation,
) -> None:
    await session.delete(recommendation)
    await session.flush()


async def create_recommendation(
    session: AsyncSession,
    recommendation_in: RecommendationCreate,
    check_id: int,
) -> Recommendation:
    data = recommendation_in.model_dump()
    data["audit_object"] = await canonicalize_audit_objects(session, data.get("audit_object"))
    await validate_recommendation_dictionary_fields(
        session,
        {"auditor": data.get("auditor")},
    )
    recommendation = await add_recommendation_row(
        session,
        data,
        check_id=check_id,
        sequence_number=await get_next_sequence_number(session, check_id),
    )
    await session.commit()
    await session.refresh(recommendation)
    return recommendation


async def get_recommendation(session: AsyncSession, recommendation_id: int) -> Optional[Recommendation]:
    result = await session.execute(
        select(Recommendation).where(Recommendation.id == recommendation_id)
    )
    return result.scalar_one_or_none()


async def list_recommendations(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    serial_number: Optional[str] = None,
) -> Sequence[Recommendation]:
    query = select(Recommendation).order_by(
        Recommendation.serial_number,
        Recommendation.sequence_number,
        Recommendation.id,
    )
    query = _apply_filters(query, search=search, serial_number=serial_number)
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


async def count_recommendations(
    session: AsyncSession,
    search: Optional[str] = None,
    serial_number: Optional[str] = None,
) -> int:
    query = select(func.count()).select_from(Recommendation)
    query = _apply_filters(query, search=search, serial_number=serial_number)
    result = await session.execute(query)
    return int(result.scalar_one())


async def update_recommendation(
    session: AsyncSession,
    recommendation: Recommendation,
    recommendation_in: RecommendationUpdate,
    check_id: Optional[int] = None,
) -> Recommendation:
    update_data = recommendation_in.model_dump(exclude_unset=True)
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

    if check_id is not None:
        recommendation.check_id = check_id
    for field, value in update_data.items():
        setattr(recommendation, field, value)

    session.add(recommendation)
    await session.flush()
    if "audit_object" in update_data:
        await sync_recommendation_audit_objects(
            session,
            recommendation.id,
            recommendation.audit_object,
        )

    if check_id is not None and check_id != previous_check_id:
        await renumber_recommendations_for_check(session, previous_check_id)
        recommendation.sequence_number = await get_next_sequence_number(session, check_id)
        session.add(recommendation)

    await session.commit()
    await session.refresh(recommendation)
    return recommendation


async def delete_recommendation(session: AsyncSession, recommendation: Recommendation) -> None:
    check_id = recommendation.check_id
    await delete_recommendation_row(session, recommendation)
    await renumber_recommendations_for_check(session, check_id)
    await session.commit()
