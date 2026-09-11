from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_crud import bind_dictionary_crud, find_dictionary_duplicate_by_label
from app.models.auditors import Auditor


crud = bind_dictionary_crud(
    model=Auditor,
    label_field="full_name",
    dictionary_name="auditors",
    order_by=(Auditor.full_name.asc(), Auditor.id.asc()),
    search_columns=(Auditor.full_name, Auditor.code),
)

create_auditor = crud.create
get_auditor = crud.get
list_auditors = crud.list
count_auditors = crud.count
update_auditor = crud.update
delete_auditor = crud.delete


async def get_auditor_by_full_name(
    session: AsyncSession, full_name: str
) -> Optional[Auditor]:
    return await find_dictionary_duplicate_by_label(
        session, Auditor, Auditor.full_name, full_name
    )
