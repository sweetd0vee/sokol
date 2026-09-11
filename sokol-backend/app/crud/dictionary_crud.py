"""Shared helpers for settings dictionaries (label/code tables). SQL only."""

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Any, Optional, TypeVar
from uuid import UUID

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.utils.dictionary_text import dictionary_match_key

ModelT = TypeVar("ModelT", bound=DeclarativeBase)
EntityT = TypeVar("EntityT")


@dataclass(frozen=True)
class DictionaryCrud:
    create: Callable[[AsyncSession, dict[str, Any]], Awaitable[EntityT]]
    get: Callable[[AsyncSession, UUID], Awaitable[EntityT | None]]
    list: Callable[[AsyncSession, int, int, Optional[str]], Awaitable[Sequence[EntityT]]]
    count: Callable[[AsyncSession, Optional[str]], Awaitable[int]]
    update: Callable[[AsyncSession, EntityT, dict[str, Any]], Awaitable[EntityT]]
    delete: Callable[[AsyncSession, EntityT], Awaitable[None]]
    model: type[Any]
    label_field: Optional[str] = None
    dictionary_name: Optional[str] = None


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


async def find_dictionary_duplicate_by_label(
    session: AsyncSession,
    model: type[ModelT],
    column: ColumnElement[Any],
    value: str,
    *,
    exclude_id: Optional[UUID] = None,
) -> Optional[ModelT]:
    normalized = dictionary_match_key(value)
    result = await session.execute(select(model))
    for item in result.scalars():
        if exclude_id is not None and getattr(item, "id") == exclude_id:
            continue
        current = getattr(item, column.key)
        if dictionary_match_key(str(current)) == normalized:
            return item
    return None


async def create_dictionary_item(
    session: AsyncSession,
    model: type[ModelT],
    payload: dict[str, Any],
) -> ModelT:
    item = model(**payload)
    session.add(item)
    await session.flush()
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
    session: AsyncSession,
    item: ModelT,
    payload: dict[str, Any],
) -> ModelT:
    for field, value in payload.items():
        setattr(item, field, value)
    session.add(item)
    await session.flush()
    await session.refresh(item)
    return item


async def delete_dictionary_item(session: AsyncSession, item: ModelT) -> None:
    await session.delete(item)
    await session.flush()


def bind_dictionary_crud(
    *,
    model: type[ModelT],
    order_by: Sequence[Any],
    search_columns: Sequence[ColumnElement[Any]],
    label_field: Optional[str] = None,
    dictionary_name: Optional[str] = None,
) -> DictionaryCrud:
    async def create(session: AsyncSession, payload: dict[str, Any]) -> ModelT:
        return await create_dictionary_item(session, model, payload)

    async def get(session: AsyncSession, item_id: UUID) -> Optional[ModelT]:
        return await get_dictionary_item(session, model, item_id)

    async def list_items(
        session: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
    ) -> Sequence[ModelT]:
        return await list_dictionary_items(
            session,
            model,
            order_by=order_by,
            skip=skip,
            limit=limit,
            search=search,
            search_columns=search_columns,
        )

    async def count(session: AsyncSession, search: Optional[str] = None) -> int:
        return await count_dictionary_items(
            session,
            model,
            search=search,
            search_columns=search_columns,
        )

    async def update(session: AsyncSession, item: ModelT, payload: dict[str, Any]) -> ModelT:
        return await update_dictionary_item(session, item, payload)

    async def delete(session: AsyncSession, item: ModelT) -> None:
        await delete_dictionary_item(session, item)

    return DictionaryCrud(
        create=create,
        get=get,
        list=list_items,
        count=count,
        update=update,
        delete=delete,
        model=model,
        label_field=label_field,
        dictionary_name=dictionary_name,
    )
