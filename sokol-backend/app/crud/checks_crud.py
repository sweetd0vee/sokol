from typing import Optional, Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check, CheckStatus


def _apply_filters(
    query,
    search: Optional[str] = None,
    status: Optional[CheckStatus] = None,
    check_type: Optional[str] = None,
):
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Check.check_name.ilike(search_term),
                Check.check_leader.ilike(search_term),
                Check.serial_number.ilike(search_term),
            )
        )
    if status:
        query = query.where(Check.status == status)
    if check_type:
        query = query.where(Check.check_type == check_type)
    return query


async def create_check(session: AsyncSession, data: dict) -> Check:
    check = Check(**data)
    session.add(check)
    await session.flush()
    await session.refresh(check)
    return check


async def get_check(session: AsyncSession, check_id: int) -> Optional[Check]:
    result = await session.execute(select(Check).where(Check.id == check_id))
    return result.scalar_one_or_none()


async def get_check_by_serial(session: AsyncSession, serial_number: str) -> Optional[Check]:
    result = await session.execute(select(Check).where(Check.serial_number == serial_number))
    return result.scalar_one_or_none()


async def list_checks(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    status: Optional[CheckStatus] = None,
    check_type: Optional[str] = None,
) -> Sequence[Check]:
    query = select(Check).order_by(Check.start_date.desc(), Check.id.desc())
    query = _apply_filters(query, search=search, status=status, check_type=check_type)
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


async def count_checks(
    session: AsyncSession,
    search: Optional[str] = None,
    status: Optional[CheckStatus] = None,
    check_type: Optional[str] = None,
) -> int:
    query = select(func.count()).select_from(Check)
    query = _apply_filters(query, search=search, status=status, check_type=check_type)
    result = await session.execute(query)
    return int(result.scalar_one())


async def update_check(session: AsyncSession, check: Check, update_data: dict) -> Check:
    for field, value in update_data.items():
        setattr(check, field, value)
    session.add(check)
    await session.flush()
    return check


async def delete_check(session: AsyncSession, check: Check) -> None:
    await session.delete(check)
    await session.flush()
