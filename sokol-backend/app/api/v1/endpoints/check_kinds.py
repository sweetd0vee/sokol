from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.check_kinds_crud import (
    count_check_kinds,
    create_check_kind,
    delete_check_kind,
    get_check_kind,
    list_check_kinds,
    update_check_kind,
)
from app.db.session import get_db_session
from app.schemas.check_kinds import (
    CheckKindCreate,
    CheckKindListResponse,
    CheckKindRead,
    CheckKindUpdate,
)


router = APIRouter(
    prefix="/settings/check_kinds", tags=["check_kinds"]
)


@router.post(
    "",
    response_model=CheckKindRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_check_kind_endpoint(
    kind_in: CheckKindCreate,
    session: AsyncSession = Depends(get_db_session),
) -> CheckKindRead:
    return await create_check_kind(session, kind_in)


@router.get("", response_model=CheckKindListResponse)
async def list_check_kinds_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, min_length=1),
    session: AsyncSession = Depends(get_db_session),
) -> CheckKindListResponse:
    items = await list_check_kinds(
        session, skip=skip, limit=limit, search=search
    )
    total = await count_check_kinds(session, search=search)
    return CheckKindListResponse(items=list(items), total=total)


@router.get("/{kind_id}", response_model=CheckKindRead)
async def get_check_kind_endpoint(
    kind_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> CheckKindRead:
    kind = await get_check_kind(session, kind_id)
    if not kind:
        raise HTTPException(status_code=404, detail="Вид проверки не найден.")
    return kind


@router.patch("/{kind_id}", response_model=CheckKindRead)
async def update_check_kind_endpoint(
    kind_id: UUID,
    kind_in: CheckKindUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> CheckKindRead:
    kind = await get_check_kind(session, kind_id)
    if not kind:
        raise HTTPException(status_code=404, detail="Вид проверки не найден.")
    return await update_check_kind(session, kind, kind_in)


@router.delete("/{kind_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_check_kind_endpoint(
    kind_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    kind = await get_check_kind(session, kind_id)
    if not kind:
        raise HTTPException(status_code=404, detail="Вид проверки не найден.")
    await delete_check_kind(session, kind)
    return None
