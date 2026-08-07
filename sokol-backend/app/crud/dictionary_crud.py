"""Shared helpers for settings dictionaries (label/code tables)."""

from collections.abc import Sequence
from typing import Any, Optional, TypeVar
from uuid import UUID

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

ModelT = TypeVar("ModelT", bound=DeclarativeBase)


def apply_ilike_search(
    query: Select[Any],
    search: Optional[str],
    *columns: ColumnElement[Any],
) -> Select[Any]:
    if not search or not columns:
        return query
    term = f"%{search.strip()}%"
    if not term.strip("%"):
        return query
    return query.where(or_(*(column.ilike(term) for column in columns)))


async def create_dictionary_item(
    session: AsyncSession, model: type[ModelT], payload: dict[str, Any]
) -> ModelT:
    item = model(**payload)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def get_dictionary_item(
    session: AsyncSession, model: type[ModelT], item_id: UUID
) -> Optional[ModelT]:
    result = await session.execute(select(model).where(model.id == item_id))
    return result.scalar_one_or_none()


async def list_dictionary_items(
    session: AsyncSession,
    model: type[ModelT],
    *,
    order_by: Sequence[Any],
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    search_columns: Sequence[ColumnElement[Any]] = (),
) -> Sequence[ModelT]:
    query = select(model).order_by(*order_by)
    query = apply_ilike_search(query, search, *search_columns)
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


async def count_dictionary_items(
    session: AsyncSession,
    model: type[ModelT],
    *,
    search: Optional[str] = None,
    search_columns: Sequence[ColumnElement[Any]] = (),
) -> int:
    query = select(func.count()).select_from(model)
    query = apply_ilike_search(query, search, *search_columns)
    result = await session.execute(query)
    return int(result.scalar_one())


async def update_dictionary_item(
    session: AsyncSession, item: ModelT, payload: dict[str, Any]
) -> ModelT:
    for field, value in payload.items():
        setattr(item, field, value)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def delete_dictionary_item(session: AsyncSession, item: ModelT) -> None:
    await session.delete(item)
    await session.commit()
