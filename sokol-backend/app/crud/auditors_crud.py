from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateDictionaryError
from app.crud.dictionary_crud import DictionaryCrud, bind_dictionary_crud, find_dictionary_duplicate_by_label
from app.models.auditors import Auditor
from app.schemas.auditors import AuditorCreate, AuditorUpdate
from app.utils.dictionary_text import normalize_dictionary_label


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
    payload = auditor_in.model_dump(exclude_unset=True)

    if "full_name" in payload and payload["full_name"] is not None:
        payload["full_name"] = normalize_dictionary_label(str(payload["full_name"]))
        duplicate_name = await find_dictionary_duplicate_by_label(
            session,
            Auditor,
            Auditor.full_name,
            payload["full_name"],
            exclude_id=auditor.id,
        )
        if duplicate_name is not None:
            raise DuplicateDictionaryError(
                dictionary="auditors",
                label=payload["full_name"],
            )

    if "code" in payload and payload["code"] is not None:
        payload["code"] = str(payload["code"]).strip().upper()
        duplicate_code = await find_dictionary_duplicate_by_label(
            session,
            Auditor,
            Auditor.code,
            payload["code"],
            exclude_id=auditor.id,
        )
        if duplicate_code is not None:
            raise DuplicateDictionaryError(dictionary="auditors", label=payload["code"])

    for field, value in payload.items():
        setattr(auditor, field, value)

    session.add(auditor)
    await session.flush()
    await session.refresh(auditor)
    return auditor


crud = DictionaryCrud(
    create=create_auditor,
    get=get_auditor,
    list=list_auditors,
    count=count_auditors,
    update=update_auditor,
    delete=delete_auditor,
)
