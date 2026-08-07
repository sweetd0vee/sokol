from collections.abc import Sequence
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.check_kinds import CheckKind
from app.schemas.check_kinds import CheckKindCreate, CheckKindUpdate


def _apply_filters(query, search: Optional[str] = None):
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(CheckKind.label.ilike(search_term))
    return query


async def create_check_kind(
    session: AsyncSession, kind_in: CheckKindCreate
) -> CheckKind:
    kind = CheckKind(**kind_in.model_dump())
    session.add(kind)
    await session.commit()
    await session.refresh(kind)
    return kind


async def get_check_kind(
    session: AsyncSession, kind_id: UUID
) -> Optional[CheckKind]:
    result = await session.execute(
        select(CheckKind).where(CheckKind.id == kind_id)
    )
    return result.scalar_one_or_none()


async def list_check_kinds(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[CheckKind]:
    query = select(CheckKind).order_by(
        CheckKind.label.asc(),
        CheckKind.id.asc(),
    )
    query = _apply_filters(query, search=search)
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


async def count_check_kinds(
    session: AsyncSession, search: Optional[str] = None
) -> int:
    query = select(func.count()).select_from(CheckKind)
    query = _apply_filters(query, search=search)
    result = await session.execute(query)
    return int(result.scalar_one())


async def update_check_kind(
    session: AsyncSession,
    kind: CheckKind,
    kind_in: CheckKindUpdate,
) -> CheckKind:
    update_data = kind_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kind, field, value)
    session.add(kind)
    await session.commit()
    await session.refresh(kind)
    return kind


async def delete_check_kind(
    session: AsyncSession, kind: CheckKind
) -> None:
    await session.delete(kind)
    await session.commit()
