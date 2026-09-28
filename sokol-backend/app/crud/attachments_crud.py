from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachments import Attachment


async def create_attachment(session: AsyncSession, attachment: Attachment) -> Attachment:
    session.add(attachment)
    await session.flush()
    await session.refresh(attachment)
    return attachment


async def get_attachment(session: AsyncSession, attachment_id: int) -> Optional[Attachment]:
    result = await session.execute(select(Attachment).where(Attachment.id == attachment_id))
    return result.scalar_one_or_none()


def _entity_filters(entity_type: str, entity_id: int, slot: Optional[str]):
    filters = [
        Attachment.entity_type == entity_type,
        Attachment.entity_id == entity_id,
    ]
    if slot:
        filters.append(Attachment.slot == slot)
    return filters


async def list_attachments(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: int,
    slot: Optional[str] = None,
) -> Sequence[Attachment]:
    query = (
        select(Attachment)
        .where(*_entity_filters(entity_type, entity_id, slot))
        .order_by(Attachment.created_at.desc(), Attachment.id.desc())
    )
    result = await session.execute(query)
    return result.scalars().all()


async def count_attachments(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: int,
    slot: Optional[str] = None,
) -> int:
    query = select(func.count()).select_from(Attachment).where(
        *_entity_filters(entity_type, entity_id, slot),
    )
    result = await session.execute(query)
    return int(result.scalar_one())


async def delete_attachment(session: AsyncSession, attachment: Attachment) -> None:
    await session.delete(attachment)
    await session.flush()


async def list_attachments_by_serial(session: AsyncSession, serial_number: str) -> Sequence[Attachment]:
    result = await session.execute(
        select(Attachment)
        .where(Attachment.check_serial_number == serial_number)
        .order_by(Attachment.created_at.desc(), Attachment.id.desc())
    )
    return result.scalars().all()
