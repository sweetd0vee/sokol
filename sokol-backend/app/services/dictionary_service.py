from typing import Optional
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ResourceNotFoundError
from app.crud.dictionary_crud import DictionaryCrud
from app.crud.dictionary_errors import DictionaryInUseError, DictionaryProtectedError
from app.services.dictionary_integrity import (
    dictionary_identity,
    dictionary_item_in_use,
)
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT

__all__ = ["DictionaryCrud", "DictionaryService"]


class DictionaryService:
    def __init__(self, crud: DictionaryCrud, not_found: str) -> None:
        self.crud = crud
        self.not_found = not_found

    async def create(self, session: AsyncSession, payload: BaseModel) -> object:
        return await self.crud.create(session, payload)

    async def list(
        self,
        session: AsyncSession,
        skip: int,
        limit: int,
        search: Optional[str],
    ) -> tuple[list[object], int]:
        items = await self.crud.list(session, skip, limit, search)
        total = await self.crud.count(session, search)
        return list(items), total

    async def get(self, session: AsyncSession, item_id: UUID) -> object:
        item = await self.crud.get(session, item_id)
        if item is None:
            raise ResourceNotFoundError(self.not_found)
        return item

    async def update(
        self,
        session: AsyncSession,
        item_id: UUID,
        payload: BaseModel,
    ) -> object:
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
