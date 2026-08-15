from collections.abc import Sequence
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_crud import (
    count_dictionary_items,
    create_dictionary_item,
    delete_dictionary_item,
    find_dictionary_duplicate_by_label,
    get_dictionary_item,
    list_dictionary_items,
    update_dictionary_item,
)
from app.crud.dictionary_errors import DuplicateDictionaryError
from app.models.auditors import Auditor
from app.schemas.auditors import AuditorCreate, AuditorUpdate


async def create_auditor(
    session: AsyncSession, auditor_in: AuditorCreate
) -> Auditor:
    duplicate = await find_dictionary_duplicate_by_label(
        session, Auditor, Auditor.code, auditor_in.code
    )
    if duplicate is not None:
        raise DuplicateDictionaryError(dictionary="auditors", label=auditor_in.code)
    return await create_dictionary_item(
        session,
        Auditor,
        auditor_in.model_dump(),
        label_field="full_name",
        dictionary_name="auditors",
    )


async def get_auditor(
    session: AsyncSession, auditor_id: UUID
) -> Optional[Auditor]:
    return await get_dictionary_item(session, Auditor, auditor_id)


async def get_auditor_by_full_name(
    session: AsyncSession, full_name: str
) -> Optional[Auditor]:
    return await find_dictionary_duplicate_by_label(
        session, Auditor, Auditor.full_name, full_name
    )


async def list_auditors(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[Auditor]:
    return await list_dictionary_items(
        session,
        Auditor,
        order_by=(Auditor.full_name.asc(), Auditor.id.asc()),
        skip=skip,
        limit=limit,
        search=search,
        search_columns=(Auditor.full_name, Auditor.code),
    )


async def count_auditors(session: AsyncSession, search: Optional[str] = None) -> int:
    return await count_dictionary_items(
        session,
        Auditor,
        search=search,
        search_columns=(Auditor.full_name, Auditor.code),
    )


async def update_auditor(
    session: AsyncSession, auditor: Auditor, auditor_in: AuditorUpdate
) -> Auditor:
    if auditor_in.code is not None:
        duplicate = await find_dictionary_duplicate_by_label(
            session,
            Auditor,
            Auditor.code,
            auditor_in.code,
            exclude_id=auditor.id,
        )
        if duplicate is not None:
            raise DuplicateDictionaryError(dictionary="auditors", label=auditor_in.code)
    return await update_dictionary_item(
        session,
        auditor,
        auditor_in.model_dump(exclude_unset=True),
        label_field="full_name",
        dictionary_name="auditors",
    )


async def delete_auditor(session: AsyncSession, auditor: Auditor) -> None:
    await delete_dictionary_item(session, auditor)
