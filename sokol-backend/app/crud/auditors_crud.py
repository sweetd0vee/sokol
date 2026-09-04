from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_crud import bind_dictionary_crud, find_dictionary_duplicate_by_label
from app.crud.dictionary_errors import DuplicateDictionaryError
from app.models.auditors import Auditor
from app.schemas.auditors import AuditorCreate, AuditorUpdate


_ops = bind_dictionary_crud(
    model=Auditor,
    label_field="full_name",
    dictionary_name="auditors",
    order_by=(Auditor.full_name.asc(), Auditor.id.asc()),
    search_columns=(Auditor.full_name, Auditor.code),
)

get_auditor = _ops.get
list_auditors = _ops.list
count_auditors = _ops.count
delete_auditor = _ops.delete


async def create_auditor(
    session: AsyncSession, auditor_in: AuditorCreate
) -> Auditor:
    duplicate = await find_dictionary_duplicate_by_label(
        session, Auditor, Auditor.code, auditor_in.code
    )
    if duplicate is not None:
        raise DuplicateDictionaryError(dictionary="auditors", label=auditor_in.code)
    return await _ops.create(session, auditor_in)


async def get_auditor_by_full_name(
    session: AsyncSession, full_name: str
) -> Optional[Auditor]:
    return await find_dictionary_duplicate_by_label(
        session, Auditor, Auditor.full_name, full_name
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
    return await _ops.update(session, auditor, auditor_in)
