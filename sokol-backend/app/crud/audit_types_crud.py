from collections.abc import Sequence
from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_types import AuditType
from app.schemas.audit_types import AuditTypeCreate, AuditTypeUpdate


def _apply_filters(query, search: Optional[str] = None):
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                AuditType.code.ilike(search_term),
                AuditType.name.ilike(search_term),
            )
        )
    return query


async def create_audit_type(
    session: AsyncSession, audit_type_in: AuditTypeCreate
) -> AuditType:
    audit_type = AuditType(**audit_type_in.model_dump())
    session.add(audit_type)
    await session.commit()
    await session.refresh(audit_type)
    return audit_type


async def get_audit_type(
    session: AsyncSession, audit_type_id: UUID
) -> Optional[AuditType]:
    result = await session.execute(
        select(AuditType).where(AuditType.id == audit_type_id)
    )
    return result.scalar_one_or_none()


async def list_audit_types(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Sequence[AuditType]:
    query = select(AuditType).order_by(
        AuditType.code.asc(),
        AuditType.name.asc(),
        AuditType.id.asc(),
    )
    query = _apply_filters(query, search=search)
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


async def count_audit_types(
    session: AsyncSession, search: Optional[str] = None
) -> int:
    query = select(func.count()).select_from(AuditType)
    query = _apply_filters(query, search=search)
    result = await session.execute(query)
    return int(result.scalar_one())


async def update_audit_type(
    session: AsyncSession,
    audit_type: AuditType,
    audit_type_in: AuditTypeUpdate,
) -> AuditType:
    update_data = audit_type_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(audit_type, field, value)
    session.add(audit_type)
    await session.commit()
    await session.refresh(audit_type)
    return audit_type


async def delete_audit_type(session: AsyncSession, audit_type: AuditType) -> None:
    await session.delete(audit_type)
    await session.commit()
