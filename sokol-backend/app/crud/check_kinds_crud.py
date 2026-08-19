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
from app.models.check_kinds import CheckKind
from app.schemas.check_kinds import CheckKindCreate, CheckKindUpdate


async def create_check_kind(
    session: AsyncSession, kind_in: CheckKindCreate
) -> CheckKind:
    return await create_dictionary_item(
        session,
        CheckKind,
        kind_in.model_dump(),
        label_field="label",
        dictionary_name="check_kinds",
    )


async def get_check_kind(
    session: AsyncSession, kind_id: UUID
) -> Optional[CheckKind]:
    return await get_dictionary_item(session, CheckKind, kind_id)


async def list_check_kinds(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[CheckKind]:
    return await list_dictionary_items(
        session,
        CheckKind,
        order_by=(CheckKind.label.asc(), CheckKind.id.asc()),
        skip=skip,
        limit=limit,
        search=search,
        search_columns=(CheckKind.label,),
    )


async def count_check_kinds(
    session: AsyncSession, search: Optional[str] = None
) -> int:
    return await count_dictionary_items(
        session,
        CheckKind,
        search=search,
        search_columns=(CheckKind.label,),
    )


async def update_check_kind(
    session: AsyncSession,
    kind: CheckKind,
    kind_in: CheckKindUpdate,
) -> CheckKind:
    return await update_dictionary_item(
        session,
        kind,
        kind_in.model_dump(exclude_unset=True),
        label_field="label",
        dictionary_name="check_kinds",
    )


async def delete_check_kind(
    session: AsyncSession, kind: CheckKind
) -> None:
    await delete_dictionary_item(session, kind)
