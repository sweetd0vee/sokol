from collections.abc import Sequence
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_crud import (
    count_dictionary_items,
    create_dictionary_item,
    delete_dictionary_item,
    get_dictionary_item,
    list_dictionary_items,
    update_dictionary_item,
)
from app.models.departments import Department
from app.schemas.departments import DepartmentCreate, DepartmentUpdate


async def create_department(
    session: AsyncSession, department_in: DepartmentCreate
) -> Department:
    return await create_dictionary_item(
        session,
        Department,
        department_in.model_dump(),
        label_field="name",
        dictionary_name="departments",
    )


async def get_department(
    session: AsyncSession, department_id: UUID
) -> Optional[Department]:
    return await get_dictionary_item(session, Department, department_id)


async def list_departments(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[Department]:
    return await list_dictionary_items(
        session,
        Department,
        order_by=(Department.name.asc(), Department.id.asc()),
        skip=skip,
        limit=limit,
        search=search,
        search_columns=(Department.name,),
    )


async def count_departments(
    session: AsyncSession, search: Optional[str] = None
) -> int:
    return await count_dictionary_items(
        session,
        Department,
        search=search,
        search_columns=(Department.name,),
    )


async def update_department(
    session: AsyncSession,
    department: Department,
    department_in: DepartmentUpdate,
) -> Department:
    return await update_dictionary_item(
        session,
        department,
        department_in.model_dump(exclude_unset=True),
        label_field="name",
        dictionary_name="departments",
    )


async def delete_department(
    session: AsyncSession, department: Department
) -> None:
    await delete_dictionary_item(session, department)
