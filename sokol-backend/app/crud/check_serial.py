from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import auditors_crud
from app.models.checks import Check
from app.services.dictionary_validation import DictionaryRefError
from app.utils.check_key import CheckKeySeed, generate_check_serial_number

CHECK_SERIAL_SOURCE_FIELDS = {"check_leader", "start_date", "check_quarter", "check_type"}


async def existing_key_seeds(
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


async def existing_serial_numbers(
    session: AsyncSession,
    *,
    exclude_check_id: int | None = None,
) -> set[str]:
    query = select(Check.serial_number)
    if exclude_check_id is not None:
        query = query.where(Check.id != exclude_check_id)
    result = await session.execute(query)
    return {serial for serial in result.scalars().all() if serial}


async def generate_unique_check_serial_number(
    session: AsyncSession,
    *,
    start_date: date,
    check_quarter: int,
    check_leader: str,
    check_type: str,
    exclude_check_id: int | None = None,
) -> str:
    auditor = await auditors_crud.get_auditor_by_full_name(session, check_leader)
    if auditor is None or not auditor.code:
        raise DictionaryRefError(
            field="check_leader",
            value=check_leader,
            dictionary="auditors",
        )
    seeds = await existing_key_seeds(session, exclude_check_id=exclude_check_id)
    existing_serials = await existing_serial_numbers(session, exclude_check_id=exclude_check_id)
    serial = generate_check_serial_number(
        start_date,
        check_quarter,
        check_leader,
        check_type,
        seeds,
        leader_code=auditor.code,
    )
    while serial in existing_serials:
        seeds.append(CheckKeySeed(check_leader, start_date, check_type))
        serial = generate_check_serial_number(
            start_date,
            check_quarter,
            check_leader,
            check_type,
            seeds,
            leader_code=auditor.code,
        )
    return serial
