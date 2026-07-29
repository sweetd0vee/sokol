from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.auditors_crud import (
    count_auditors,
    create_auditor,
    delete_auditor,
    get_auditor,
    list_auditors,
    update_auditor,
)
from app.db.session import get_db_session
from app.schemas.auditors import (
    AuditorCreate,
    AuditorListResponse,
    AuditorRead,
    AuditorUpdate,
)


router = APIRouter(prefix="/settings/auditors", tags=["auditors"])


@router.post("", response_model=AuditorRead, status_code=status.HTTP_201_CREATED)
async def create_auditor_endpoint(
    auditor_in: AuditorCreate,
    session: AsyncSession = Depends(get_db_session),
) -> AuditorRead:
    return await create_auditor(session, auditor_in)


@router.get("", response_model=AuditorListResponse)
async def list_auditors_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, min_length=1),
    session: AsyncSession = Depends(get_db_session),
) -> AuditorListResponse:
    items = await list_auditors(session, skip=skip, limit=limit, search=search)
    total = await count_auditors(session, search=search)
    return AuditorListResponse(items=list(items), total=total)


@router.get("/{auditor_id}", response_model=AuditorRead)
async def get_auditor_endpoint(
    auditor_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> AuditorRead:
    auditor = await get_auditor(session, auditor_id)
    if not auditor:
        raise HTTPException(status_code=404, detail="Аудитор не найден.")
    return auditor


@router.patch("/{auditor_id}", response_model=AuditorRead)
async def update_auditor_endpoint(
    auditor_id: UUID,
    auditor_in: AuditorUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> AuditorRead:
    auditor = await get_auditor(session, auditor_id)
    if not auditor:
        raise HTTPException(status_code=404, detail="Аудитор не найден.")
    return await update_auditor(session, auditor, auditor_in)


@router.delete("/{auditor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_auditor_endpoint(
    auditor_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    auditor = await get_auditor(session, auditor_id)
    if not auditor:
        raise HTTPException(status_code=404, detail="Аудитор не найден.")
    await delete_auditor(session, auditor)
    return None
