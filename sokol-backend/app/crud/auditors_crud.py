from collections.abc import Sequence
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auditors import Auditor
from app.schemas.auditors import AuditorCreate, AuditorUpdate


def _apply_filters(query, search: Optional[str] = None):
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(Auditor.full_name.ilike(search_term))
    return query


async def create_auditor(
    session: AsyncSession, auditor_in: AuditorCreate
) -> Auditor:
    auditor = Auditor(**auditor_in.model_dump())
    session.add(auditor)
    await session.commit()
    await session.refresh(auditor)
    return auditor


async def get_auditor(
    session: AsyncSession, auditor_id: UUID
) -> Optional[Auditor]:
    result = await session.execute(select(Auditor).where(Auditor.id == auditor_id))
    return result.scalar_one_or_none()


async def list_auditors(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[Auditor]:
    query = select(Auditor).order_by(Auditor.full_name.asc(), Auditor.id.asc())
    query = _apply_filters(query, search=search)
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


async def count_auditors(session: AsyncSession, search: Optional[str] = None) -> int:
    query = select(func.count()).select_from(Auditor)
    query = _apply_filters(query, search=search)
    result = await session.execute(query)
    return int(result.scalar_one())


async def update_auditor(
    session: AsyncSession, auditor: Auditor, auditor_in: AuditorUpdate
) -> Auditor:
    update_data = auditor_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(auditor, field, value)
    session.add(auditor)
    await session.commit()
    await session.refresh(auditor)
    return auditor


async def delete_auditor(session: AsyncSession, auditor: Auditor) -> None:
    await session.delete(auditor)
    await session.commit()
