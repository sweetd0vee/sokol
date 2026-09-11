import logging
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DictionaryRefError, ResourceNotFoundError
from app.crud import attachments_crud, auditors_crud, checks_crud
from app.crud.check_serial import (
    CHECK_SERIAL_SOURCE_FIELDS,
    generate_unique_check_serial_number,
)
from app.models.checks import Check, CheckStatus
from app.schemas.checks import CheckCreate, CheckListResponse, CheckUpdate
from app.services.check_serial_cascade import SerialRewrite, apply_serial_rewrites, cleanup_old_serial_buckets
from app.services.dictionary_integrity import (
    EFFECTIVENESS_FIELDS,
    normalize_optional_dictionary_label,
)
from app.services.dictionary_validation import validate_check_dictionary_fields
from app.services.recommendation_status import today_moscow
from app.services.storage.minio_storage import get_storage

logger = logging.getLogger(__name__)


def _normalize_effectiveness_fields(data: dict) -> None:
    for field in EFFECTIVENESS_FIELDS:
        if field in data:
            data[field] = normalize_optional_dictionary_label(data[field])


async def _allocate_check_serial(
    session: AsyncSession,
    *,
    start_date,
    check_quarter: int,
    check_leader: str,
    check_type: str,
    exclude_check_id: int | None = None,
) -> str:
    auditor = await auditors_crud.get_auditor_by_full_name(session, check_leader)
    serial = await generate_unique_check_serial_number(
        session,
        start_date=start_date,
        check_quarter=check_quarter,
        check_leader=check_leader,
        check_type=check_type,
        exclude_check_id=exclude_check_id,
        leader_code=auditor.code if auditor is not None else None,
    )
    if serial is None:
        raise DictionaryRefError(
            field="check_leader",
            value=check_leader,
            dictionary="auditors",
        )
    return serial
    for field in EFFECTIVENESS_FIELDS:
        if field in data:
            data[field] = normalize_optional_dictionary_label(data[field])


async def create_check(session: AsyncSession, check_in: CheckCreate) -> Check:
    data = check_in.model_dump()
    data.pop("serial_number", None)
    _normalize_effectiveness_fields(data)
    await validate_check_dictionary_fields(session, data)
    if not data.get("created_at"):
        data["created_at"] = today_moscow()

    last_integrity_error: IntegrityError | None = None
    check: Check | None = None
    try:
        for _ in range(2):
            data["serial_number"] = await generate_unique_check_serial_number(
                session,
                start_date=data["start_date"],
                check_quarter=data["check_quarter"],
                check_leader=data["check_leader"],
                check_type=data["check_type"],
            )
            try:
                check = await checks_crud.create_check(session, data)
                break
            except IntegrityError as exc:
                last_integrity_error = exc
                await session.rollback()
        else:
            if last_integrity_error is not None:
                raise last_integrity_error
            raise RuntimeError("Failed to create check.")

        if check is None:
            raise RuntimeError("Failed to create check.")
        await session.commit()
        await session.refresh(check)
    except Exception:
        await session.rollback()
        raise

    storage = get_storage()
    if storage is not None:
        try:
            await storage.ensure_check_bucket(check.serial_number)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to create MinIO bucket for check %s", check.serial_number)

    return check


async def list_checks(
    session: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 200,
    search: Optional[str] = None,
    status: Optional[CheckStatus] = None,
    check_type: Optional[str] = None,
) -> CheckListResponse:
    items = await checks_crud.list_checks(
        session,
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        check_type=check_type,
    )
    total = await checks_crud.count_checks(
        session,
        search=search,
        status=status,
        check_type=check_type,
    )
    return CheckListResponse(items=list(items), total=total)


async def get_check(session: AsyncSession, check_id: int) -> Check:
    check = await checks_crud.get_check(session, check_id)
    if check is None:
        raise ResourceNotFoundError("Проверка не найдена.")
    return check


async def update_check(
    session: AsyncSession,
    check_id: int,
    check_in: CheckUpdate,
) -> Check:
    check = await get_check(session, check_id)
    update_data = check_in.model_dump(exclude_unset=True)
    update_data.pop("serial_number", None)
    _normalize_effectiveness_fields(update_data)
    await validate_check_dictionary_fields(session, update_data)

    old_serial_number = check.serial_number
    should_regenerate_serial = any(
        field in update_data and getattr(check, field) != update_data[field]
        for field in CHECK_SERIAL_SOURCE_FIELDS
    )

    try:
        await checks_crud.update_check(session, check, update_data)
        rewrites: list[SerialRewrite] = []
        if should_regenerate_serial:
            new_serial = await generate_unique_check_serial_number(
                session,
                start_date=check.start_date,
                check_quarter=check.check_quarter,
                check_leader=check.check_leader,
                check_type=check.check_type,
                exclude_check_id=check.id,
            )
            if new_serial != old_serial_number:
                rewrites = [
                    SerialRewrite(
                        check_id=check.id,
                        old_serial=old_serial_number,
                        new_serial=new_serial,
                    )
                ]
                await apply_serial_rewrites(session, rewrites, commit=False)

        await session.commit()
        await session.refresh(check)
    except Exception:
        await session.rollback()
        raise

    if rewrites:
        await cleanup_old_serial_buckets(rewrites)
    return check


async def delete_check(session: AsyncSession, check_id: int) -> None:
    check = await get_check(session, check_id)
    serial_number = check.serial_number
    attachment_rows = await attachments_crud.list_attachments_by_serial(session, serial_number)
    storage = get_storage()

    try:
        for attachment in attachment_rows:
            if storage is not None:
                try:
                    await storage.delete_object(attachment.bucket, attachment.object_key)
                except Exception:  # noqa: BLE001
                    logger.exception("Failed to delete attachment object %s", attachment.id)
            await attachments_crud.delete_attachment(session, attachment)

        await checks_crud.delete_check(session, check)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    if storage is not None:
        try:
            await storage.delete_check_bucket(serial_number)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to delete MinIO bucket for check %s", serial_number)
