"""Factory for settings dictionary CRUD routers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Any, Optional, TypeVar
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.crud.dictionary_errors import DuplicateDictionaryError
from app.db.session import get_db_session

CreateT = TypeVar("CreateT", bound=BaseModel)
UpdateT = TypeVar("UpdateT", bound=BaseModel)
ReadT = TypeVar("ReadT", bound=BaseModel)
ListT = TypeVar("ListT", bound=BaseModel)
EntityT = TypeVar("EntityT")


@dataclass(frozen=True)
class DictionaryCrud:
    create: Callable[[AsyncSession, CreateT], Awaitable[EntityT]]
    get: Callable[[AsyncSession, UUID], Awaitable[EntityT | None]]
    list: Callable[[AsyncSession, int, int, Optional[str]], Awaitable[Sequence[EntityT]]]
    count: Callable[[AsyncSession, Optional[str]], Awaitable[int]]
    update: Callable[[AsyncSession, EntityT, UpdateT], Awaitable[EntityT]]
    delete: Callable[[AsyncSession, EntityT], Awaitable[None]]


@dataclass(frozen=True)
class DictionaryRouterConfig:
    prefix: str
    tags: list[str]
    crud: DictionaryCrud
    create_schema: type[CreateT]
    update_schema: type[UpdateT]
    read_schema: type[ReadT]
    list_schema: type[ListT]
    not_found: str
    handle_duplicates: bool = False


def make_dictionary_router(config: DictionaryRouterConfig) -> APIRouter:
    router = APIRouter(prefix=config.prefix, tags=config.tags)
    crud = config.crud
    create_schema = config.create_schema
    update_schema = config.update_schema
    read_schema = config.read_schema
    list_schema = config.list_schema

    @router.post("", response_model=read_schema, status_code=status.HTTP_201_CREATED)
    async def create_endpoint(
        payload: create_schema,  # type: ignore[valid-type]
        session: AsyncSession = Depends(get_db_session),
        _: object = Depends(require_admin),
    ) -> Any:
        try:
            return await crud.create(session, payload)
        except DuplicateDictionaryError as exc:
            if config.handle_duplicates:
                raise HTTPException(status_code=409, detail=str(exc)) from exc
            raise

    @router.get("", response_model=list_schema)
    async def list_endpoint(
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
        search: Optional[str] = Query(None, min_length=1),
        session: AsyncSession = Depends(get_db_session),
    ) -> Any:
        items = await crud.list(session, skip, limit, search)
        total = await crud.count(session, search)
        return list_schema(items=list(items), total=total)

    @router.get("/{item_id}", response_model=read_schema)
    async def get_endpoint(
        item_id: UUID,
        session: AsyncSession = Depends(get_db_session),
    ) -> Any:
        item = await crud.get(session, item_id)
        if not item:
            raise HTTPException(status_code=404, detail=config.not_found)
        return item

    @router.patch("/{item_id}", response_model=read_schema)
    async def update_endpoint(
        item_id: UUID,
        payload: update_schema,  # type: ignore[valid-type]
        session: AsyncSession = Depends(get_db_session),
        _: object = Depends(require_admin),
    ) -> Any:
        item = await crud.get(session, item_id)
        if not item:
            raise HTTPException(status_code=404, detail=config.not_found)
        try:
            return await crud.update(session, item, payload)
        except DuplicateDictionaryError as exc:
            if config.handle_duplicates:
                raise HTTPException(status_code=409, detail=str(exc)) from exc
            raise

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_endpoint(
        item_id: UUID,
        session: AsyncSession = Depends(get_db_session),
        _: object = Depends(require_admin),
    ) -> None:
        item = await crud.get(session, item_id)
        if not item:
            raise HTTPException(status_code=404, detail=config.not_found)
        await crud.delete(session, item)
        return None

    return router
