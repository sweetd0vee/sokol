from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.crud.dictionary_errors import DuplicateDictionaryError
from app.crud.departments_crud import (
    count_departments,
    create_department,
    delete_department,
    get_department,
    list_departments,
    update_department,
)
from app.db.session import get_db_session
from app.schemas.departments import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentRead,
    DepartmentUpdate,
)


router = APIRouter(prefix="/settings/departments", tags=["departments"])


@router.post(
    "",
    response_model=DepartmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_department_endpoint(
    department_in: DepartmentCreate,
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> DepartmentRead:
    try:
        return await create_department(session, department_in)
    except DuplicateDictionaryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("", response_model=DepartmentListResponse)
async def list_departments_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, min_length=1),
    session: AsyncSession = Depends(get_db_session),
) -> DepartmentListResponse:
    items = await list_departments(
        session, skip=skip, limit=limit, search=search
    )
    total = await count_departments(session, search=search)
    return DepartmentListResponse(items=list(items), total=total)


@router.get("/{department_id}", response_model=DepartmentRead)
async def get_department_endpoint(
    department_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> DepartmentRead:
    department = await get_department(session, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Департамент не найден.")
    return department


@router.patch("/{department_id}", response_model=DepartmentRead)
async def update_department_endpoint(
    department_id: UUID,
    department_in: DepartmentUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> DepartmentRead:
    department = await get_department(session, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Департамент не найден.")
    try:
        return await update_department(session, department, department_in)
    except DuplicateDictionaryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department_endpoint(
    department_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> None:
    department = await get_department(session, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Департамент не найден.")
    await delete_department(session, department)
    return None
