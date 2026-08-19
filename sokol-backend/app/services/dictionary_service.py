from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_errors import DictionaryInUseError, DictionaryProtectedError
from app.services.crud_errors import ResourceNotFoundError
from app.services.dictionary_integrity import (
    dictionary_identity,
    dictionary_item_in_use,
)
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT

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
        identity = dictionary_identity(item)
        if identity is not None:
            dictionary, label = identity
            if dictionary == "departments" and label == UNSPECIFIED_AUDIT_OBJECT:
                raise DictionaryProtectedError(
                    dictionary=dictionary,
                    label=label,
                    action="удалить",
                )
            if await dictionary_item_in_use(session, item):
                raise DictionaryInUseError(dictionary=dictionary, label=label)
        try:
            await self.crud.delete(session, item)
        except IntegrityError as exc:
            await session.rollback()
            dictionary, label = identity or ("dictionary", str(item_id))
            raise DictionaryInUseError(dictionary=dictionary, label=label) from exc

