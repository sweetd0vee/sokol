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
from app.models.audit_types import AuditType
from app.schemas.audit_types import AuditTypeCreate, AuditTypeUpdate


async def create_audit_type(
    session: AsyncSession, audit_type_in: AuditTypeCreate
) -> AuditType:
    return await create_dictionary_item(
        session, AuditType, audit_type_in.model_dump()
    )


async def get_audit_type(
    session: AsyncSession, audit_type_id: UUID
) -> Optional[AuditType]:
    return await get_dictionary_item(session, AuditType, audit_type_id)


async def list_audit_types(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[AuditType]:
    return await list_dictionary_items(
        session,
        AuditType,
        order_by=(
            AuditType.code.asc(),
            AuditType.name.asc(),
            AuditType.id.asc(),
        ),
        skip=skip,
        limit=limit,
        search=search,
        search_columns=(AuditType.code, AuditType.name),
    )


async def count_audit_types(
    session: AsyncSession, search: Optional[str] = None
) -> int:
    return await count_dictionary_items(
        session,
        AuditType,
        search=search,
        search_columns=(AuditType.code, AuditType.name),
    )


async def update_audit_type(
    session: AsyncSession,
    audit_type: AuditType,
    audit_type_in: AuditTypeUpdate,
) -> AuditType:
    return await update_dictionary_item(
        session, audit_type, audit_type_in.model_dump(exclude_unset=True)
    )


async def delete_audit_type(session: AsyncSession, audit_type: AuditType) -> None:
    await delete_dictionary_item(session, audit_type)
