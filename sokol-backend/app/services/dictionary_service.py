from typing import Optional
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    DictionaryInUseError,
    DictionaryProtectedError,
    DuplicateDictionaryError,
    ResourceNotFoundError,
)
from app.crud.dictionary_crud import DictionaryCrud
from app.models.auditors import Auditor
from app.models.departments import Department
from app.services.check_serial_cascade import (
    cascade_auditor_code_in_check_keys,
    cleanup_old_serial_buckets,
)
from app.services.dictionary_integrity import (
    dictionary_identity,
    dictionary_item_in_use,
    replace_recommendation_audit_object_label,
)
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT, normalize_dictionary_label

__all__ = ["DictionaryCrud", "DictionaryService"]


class DictionaryService:
    def __init__(self, crud: DictionaryCrud, not_found: str) -> None:
        self.crud = crud
        self.not_found = not_found

    async def create(self, session: AsyncSession, payload: BaseModel) -> object:
        item = await self.crud.create(session, payload)
        await session.commit()
        return item

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
        if isinstance(item, Auditor):
            return await self._update_auditor(session, item, payload)
        if isinstance(item, Department):
            return await self._update_department(session, item, payload)
        updated = await self.crud.update(session, item, payload)
        await session.commit()
        return updated

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
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            dictionary, label = identity or ("dictionary", str(item_id))
            raise DictionaryInUseError(dictionary=dictionary, label=label) from exc

    async def _update_auditor(
        self,
        session: AsyncSession,
        auditor: Auditor,
        payload: BaseModel,
    ) -> Auditor:
        old_code = auditor.code
        old_name = auditor.full_name
        updated = await self.crud.update(session, auditor, payload)
        rewrites = []
        if updated.code != old_code:
            # Checks still reference the previous full_name until this transaction
            # commits (ON UPDATE CASCADE runs at commit).
            rewrites = await cascade_auditor_code_in_check_keys(
                session,
                check_leader=old_name,
                old_code=old_code,
                new_code=updated.code,
            )
        await session.commit()
        if rewrites:
            await cleanup_old_serial_buckets(rewrites)
        return updated

    async def _update_department(
        self,
        session: AsyncSession,
        department: Department,
        payload: BaseModel,
    ) -> Department:
        payload_data = payload.model_dump(exclude_unset=True)
        old_name = department.name
        new_name = payload_data.get("name")
        if new_name is not None:
            normalized = normalize_dictionary_label(str(new_name))
            if old_name == UNSPECIFIED_AUDIT_OBJECT and normalized != old_name:
                raise DictionaryProtectedError(
                    dictionary="departments",
                    label=old_name,
                    action="переименовать",
                )
            if normalized != old_name:
                await replace_recommendation_audit_object_label(
                    session, old_name, normalized
                )
        try:
            updated = await self.crud.update(session, department, payload)
            await session.commit()
            return updated
        except DuplicateDictionaryError:
            await session.rollback()
            raise
