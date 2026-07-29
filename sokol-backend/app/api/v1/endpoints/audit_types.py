from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.audit_types_crud import (
    count_audit_types,
    create_audit_type,
    delete_audit_type,
    get_audit_type,
    list_audit_types,
    update_audit_type,
)
from app.db.session import get_db_session
from app.schemas.audit_types import (
    AuditTypeCreate,
    AuditTypeListResponse,
    AuditTypeRead,
    AuditTypeUpdate,
)


router = APIRouter(prefix="/settings/audit_types", tags=["audit_types"])


@router.post("", response_model=AuditTypeRead, status_code=status.HTTP_201_CREATED)
async def create_audit_type_endpoint(
    audit_type_in: AuditTypeCreate,
    session: AsyncSession = Depends(get_db_session),
) -> AuditTypeRead:
    return await create_audit_type(session, audit_type_in)


@router.get("", response_model=AuditTypeListResponse)
async def list_audit_types_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, min_length=1),
    session: AsyncSession = Depends(get_db_session),
) -> AuditTypeListResponse:
    items = await list_audit_types(session, skip=skip, limit=limit, search=search)
    total = await count_audit_types(session, search=search)
    return AuditTypeListResponse(items=list(items), total=total)


@router.get("/{audit_type_id}", response_model=AuditTypeRead)
async def get_audit_type_endpoint(
    audit_type_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> AuditTypeRead:
    audit_type = await get_audit_type(session, audit_type_id)
    if not audit_type:
        raise HTTPException(status_code=404, detail="Тип аудита не найден.")
    return audit_type


@router.patch("/{audit_type_id}", response_model=AuditTypeRead)
async def update_audit_type_endpoint(
    audit_type_id: UUID,
    audit_type_in: AuditTypeUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> AuditTypeRead:
    audit_type = await get_audit_type(session, audit_type_id)
    if not audit_type:
        raise HTTPException(status_code=404, detail="Тип аудита не найден.")
    return await update_audit_type(session, audit_type, audit_type_in)


@router.delete("/{audit_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audit_type_endpoint(
    audit_type_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    audit_type = await get_audit_type(session, audit_type_id)
    if not audit_type:
        raise HTTPException(status_code=404, detail="Тип аудита не найден.")
    await delete_audit_type(session, audit_type)
    return None
