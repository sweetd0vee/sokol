from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import checks_crud
from app.models.checks import Check, CheckStatus
from app.schemas.checks import CheckCreate, CheckListResponse, CheckUpdate
from app.core.exceptions import ResourceNotFoundError


async def create_check(session: AsyncSession, check_in: CheckCreate) -> Check:
    return await checks_crud.create_check(session, check_in)


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
    return await checks_crud.update_check(session, check, check_in)


async def delete_check(session: AsyncSession, check_id: int) -> None:
    check = await get_check(session, check_id)
    await checks_crud.delete_check(session, check)

