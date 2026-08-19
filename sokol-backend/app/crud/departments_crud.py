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
from app.crud.dictionary_errors import DuplicateDictionaryError, DictionaryProtectedError
from app.models.departments import Department
from app.schemas.departments import DepartmentCreate, DepartmentUpdate
from app.services.dictionary_integrity import replace_recommendation_audit_object_label
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT, normalize_dictionary_label


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
    payload = department_in.model_dump(exclude_unset=True)
    old_name = department.name
    new_name = payload.get("name")
    if new_name is not None:
        normalized = normalize_dictionary_label(str(new_name))
        if old_name == UNSPECIFIED_AUDIT_OBJECT and normalized != old_name:
            raise DictionaryProtectedError(
                dictionary="departments",
                label=old_name,
                action="переименовать",
            )
        if normalized != old_name:
            await replace_recommendation_audit_object_label(
                session, old_name, normalized
            )
    try:
        return await update_dictionary_item(
            session,
            department,
            payload,
            label_field="name",
            dictionary_name="departments",
        )
    except DuplicateDictionaryError:
        await session.rollback()
        raise


async def delete_department(
    session: AsyncSession, department: Department
) -> None:
    await delete_dictionary_item(session, department)
