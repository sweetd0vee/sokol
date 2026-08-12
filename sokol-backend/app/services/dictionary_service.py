from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.crud_errors import ResourceNotFoundError

CreateT = TypeVar("CreateT", bound=BaseModel)
UpdateT = TypeVar("UpdateT", bound=BaseModel)
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
class DictionaryService:
    crud: DictionaryCrud
    not_found: str

    async def create(self, session: AsyncSession, payload: CreateT) -> EntityT:
        return await self.crud.create(session, payload)

    async def list(
        self,
        session: AsyncSession,
        skip: int,
        limit: int,
        search: Optional[str],
    ) -> tuple[list[EntityT], int]:
        items = await self.crud.list(session, skip, limit, search)
        total = await self.crud.count(session, search)
        return list(items), total

    async def get(self, session: AsyncSession, item_id: UUID) -> EntityT:
        item = await self.crud.get(session, item_id)
        if item is None:
            raise ResourceNotFoundError(self.not_found)
        return item

    async def update(
        self,
        session: AsyncSession,
        item_id: UUID,
        payload: UpdateT,
    ) -> EntityT:
        item = await self.get(session, item_id)
        return await self.crud.update(session, item, payload)

    async def delete(self, session: AsyncSession, item_id: UUID) -> None:
        item = await self.get(session, item_id)
        await self.crud.delete(session, item)

