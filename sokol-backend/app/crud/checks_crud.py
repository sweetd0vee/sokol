from datetime import date
from typing import Optional, Sequence

import logging

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.attachments_crud import list_attachments_by_serial
from app.models.attachments import Attachment
from app.models.checks import Check, CheckStatus
from app.models.recommendations import Recommendation
from app.schemas.checks import CheckCreate, CheckUpdate
from app.services.dictionary_validation import validate_check_dictionary_fields
from app.services.storage.minio_storage import get_storage
from app.utils.check_key import CheckKeySeed, generate_check_serial_number

logger = logging.getLogger(__name__)
CHECK_SERIAL_SOURCE_FIELDS = {"check_leader", "start_date", "check_type"}


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


async def _existing_key_seeds(
    session: AsyncSession,
    *,
    exclude_check_id: int | None = None,
) -> list[CheckKeySeed]:
    query = select(Check.check_leader, Check.start_date, Check.check_type)
    if exclude_check_id is not None:
        query = query.where(Check.id != exclude_check_id)
    result = await session.execute(query)
    return [
        CheckKeySeed(leader=row.check_leader, start_date=row.start_date, check_type=row.check_type)
        for row in result.all()
    ]


async def _existing_serial_numbers(
    session: AsyncSession,
    *,
    exclude_check_id: int | None = None,
) -> set[str]:
    query = select(Check.serial_number)
    if exclude_check_id is not None:
        query = query.where(Check.id != exclude_check_id)
    result = await session.execute(query)
    return {serial for serial in result.scalars().all() if serial}


async def _generate_unique_check_serial_number(
    session: AsyncSession,
    *,
    start_date: date,
    check_leader: str,
    check_type: str,
    exclude_check_id: int | None = None,
) -> str:
    seeds = await _existing_key_seeds(session, exclude_check_id=exclude_check_id)
    existing_serials = await _existing_serial_numbers(session, exclude_check_id=exclude_check_id)
    serial = generate_check_serial_number(start_date, check_leader, check_type, seeds)
    while serial in existing_serials:
        seeds.append(CheckKeySeed(check_leader, start_date, check_type))
        serial = generate_check_serial_number(start_date, check_leader, check_type, seeds)
    return serial


async def create_check(session: AsyncSession, check_in: CheckCreate) -> Check:
    data = check_in.model_dump()
    data.pop("serial_number", None)
    await validate_check_dictionary_fields(session, data)
    if not data.get("created_at"):
        data["created_at"] = date.today()

    last_integrity_error: IntegrityError | None = None
    for _ in range(2):
        data["serial_number"] = await _generate_unique_check_serial_number(
            session,
            start_date=data["start_date"],
            check_leader=data["check_leader"],
            check_type=data["check_type"],
        )
        check = Check(**data)
        session.add(check)
        try:
            await session.commit()
            await session.refresh(check)
            break
        except IntegrityError as exc:
            last_integrity_error = exc
            await session.rollback()
    else:
        if last_integrity_error is not None:
            raise last_integrity_error
        raise RuntimeError("Failed to create check.")

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
    update_data.pop("serial_number", None)
    await validate_check_dictionary_fields(session, update_data)
    old_serial_number = check.serial_number
    should_regenerate_serial = any(
        field in update_data and getattr(check, field) != update_data[field]
        for field in CHECK_SERIAL_SOURCE_FIELDS
    )
    for field, value in update_data.items():
        setattr(check, field, value)
    if should_regenerate_serial:
        check.serial_number = await _generate_unique_check_serial_number(
            session,
            start_date=check.start_date,
            check_leader=check.check_leader,
            check_type=check.check_type,
            exclude_check_id=check.id,
        )
        if check.serial_number != old_serial_number:
            await session.execute(
                update(Recommendation)
                .where(Recommendation.check_id == check.id)
                .values(serial_number=check.serial_number),
            )
            await session.execute(
                update(Attachment)
                .where(Attachment.check_serial_number == old_serial_number)
                .values(check_serial_number=check.serial_number),
            )
    session.add(check)
    await session.commit()
    await session.refresh(check)
    return check


async def delete_check(session: AsyncSession, check: Check) -> None:
    serial_number = check.serial_number

    attachment_rows = await list_attachments_by_serial(session, serial_number)
    storage = get_storage()
    for attachment in attachment_rows:
        if storage is not None:
            try:
                await storage.delete_object(attachment.bucket, attachment.object_key)
            except Exception:  # noqa: BLE001
                logger.exception("Failed to delete attachment object %s", attachment.id)
        await session.delete(attachment)

    await session.delete(check)
    await session.commit()

    if storage is not None:
        try:
            await storage.delete_check_bucket(serial_number)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to delete MinIO bucket for check %s", serial_number)
