from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db.session import get_db_session
from app.models.checks import CheckStatus
from app.schemas.checks import CheckCreate, CheckListResponse, CheckRead, CheckUpdate
from app.services import checks_service


router = APIRouter(prefix="/checks", tags=["checks"])


@router.post("", response_model=CheckRead, status_code=status.HTTP_201_CREATED)
async def create_check_endpoint(
    check_in: CheckCreate,
    session: AsyncSession = Depends(get_db_session),
) -> CheckRead:
    return await checks_service.create_check(session, check_in)


@router.get("", response_model=CheckListResponse)
async def list_checks_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=10000),
    search: Optional[str] = Query(None, min_length=1),
    status: Optional[CheckStatus] = None,
    check_type: Optional[str] = Query(None, min_length=1),
    session: AsyncSession = Depends(get_db_session),
) -> CheckListResponse:
    return await checks_service.list_checks(
        session,
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        check_type=check_type,
    )


@router.get("/{check_id}", response_model=CheckRead)
async def get_check_endpoint(
    check_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> CheckRead:
    return await checks_service.get_check(session, check_id)


@router.patch("/{check_id}", response_model=CheckRead)
async def update_check_endpoint(
    check_id: int,
    check_in: CheckUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> CheckRead:
    return await checks_service.update_check(session, check_id, check_in)


@router.delete("/{check_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_check_endpoint(
    check_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> None:
    await checks_service.delete_check(session, check_id)
