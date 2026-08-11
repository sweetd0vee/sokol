from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.checks_crud import (
    count_checks,
    create_check,
    delete_check,
    get_check,
    list_checks,
    update_check,
)
from app.db.session import get_db_session
from app.models.checks import CheckStatus
from app.schemas.checks import CheckCreate, CheckListResponse, CheckRead, CheckUpdate
from app.services.dictionary_validation import DictionaryRefError


router = APIRouter(prefix="/checks", tags=["checks"])


@router.post("", response_model=CheckRead, status_code=status.HTTP_201_CREATED)
async def create_check_endpoint(
    check_in: CheckCreate,
    session: AsyncSession = Depends(get_db_session),
) -> CheckRead:
    try:
        return await create_check(session, check_in)
    except DictionaryRefError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=CheckListResponse)
async def list_checks_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    search: Optional[str] = Query(None, min_length=1),
    status: Optional[CheckStatus] = None,
    check_type: Optional[str] = Query(None, min_length=1),
    session: AsyncSession = Depends(get_db_session),
) -> CheckListResponse:
    items = await list_checks(
        session,
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        check_type=check_type,
    )
    total = await count_checks(
        session,
        search=search,
        status=status,
        check_type=check_type,
    )
    return CheckListResponse(items=list(items), total=total)


@router.get("/{check_id}", response_model=CheckRead)
async def get_check_endpoint(
    check_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> CheckRead:
    check = await get_check(session, check_id)
    if not check:
        raise HTTPException(status_code=404, detail="Проверка не найдена.")
    return check


@router.patch("/{check_id}", response_model=CheckRead)
async def update_check_endpoint(
    check_id: int,
    check_in: CheckUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> CheckRead:
    check = await get_check(session, check_id)
    if not check:
        raise HTTPException(status_code=404, detail="Проверка не найдена.")
    try:
        return await update_check(session, check, check_in)
    except DictionaryRefError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{check_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_check_endpoint(
    check_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    check = await get_check(session, check_id)
    if not check:
        raise HTTPException(status_code=404, detail="Проверка не найдена.")
    await delete_check(session, check)
    return None
