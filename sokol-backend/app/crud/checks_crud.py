from datetime import date
from typing import Optional, Sequence

import logging

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.attachments_crud import list_attachments_by_serial
from app.models.checks import Check, CheckStatus
from app.schemas.checks import CheckCreate, CheckUpdate
from app.services.storage.minio_storage import get_storage
from app.utils.check_key import CheckKeySeed, generate_check_serial_number

logger = logging.getLogger(__name__)


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


async def _existing_key_seeds(session: AsyncSession) -> list[CheckKeySeed]:
    result = await session.execute(select(Check.check_leader, Check.start_date, Check.check_type))
    return [
        CheckKeySeed(leader=row.check_leader, start_date=row.start_date, check_type=row.check_type)
        for row in result.all()
    ]


async def create_check(session: AsyncSession, check_in: CheckCreate) -> Check:
    data = check_in.model_dump()
    if not data.get("created_at"):
        data["created_at"] = date.today()
    if not data.get("serial_number"):
        data["serial_number"] = generate_check_serial_number(
            data["start_date"],
            data["check_leader"],
            data["check_type"],
            await _existing_key_seeds(session),
        )
    check = Check(**data)
    session.add(check)
    await session.commit()
    await session.refresh(check)

    storage = get_storage()
    if storage is not None:
        try:
            await storage.ensure_check_bucket(check.serial_number)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to create MinIO bucket for check %s", check.serial_number)

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


async def update_check(
    session: AsyncSession, check: Check, check_in: CheckUpdate
) -> Check:
    update_data = check_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(check, field, value)
    session.add(check)
    await session.commit()
    await session.refresh(check)
    return check


async def delete_check(session: AsyncSession, check: Check) -> None:
    serial_number = check.serial_number

    attachment_rows = await list_attachments_by_serial(session, serial_number)
    for attachment in attachment_rows:
        await session.delete(attachment)

    await session.delete(check)
    await session.commit()

    storage = get_storage()
    if storage is not None:
        try:
            await storage.delete_check_bucket(serial_number)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to delete MinIO bucket for check %s", serial_number)
