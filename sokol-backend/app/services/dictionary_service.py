from typing import Any, Optional
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
from app.services.dictionary_validation import assert_unique_dictionary_value
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT, normalize_dictionary_label

__all__ = ["DictionaryCrud", "DictionaryService"]


class DictionaryService:
    def __init__(self, crud: DictionaryCrud, not_found: str) -> None:
        self.crud = crud
        self.not_found = not_found

    async def create(self, session: AsyncSession, payload: BaseModel) -> object:
        data = await self._prepare_payload(session, payload.model_dump())
        item = await self.crud.create(session, data)
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
        data = payload.model_dump(exclude_unset=True)
        if isinstance(item, Auditor):
            return await self._update_auditor(session, item, data)
        if isinstance(item, Department):
            return await self._update_department(session, item, data)
        prepared = await self._prepare_payload(session, data, existing=item)
        updated = await self.crud.update(session, item, prepared)
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

    async def _prepare_payload(
        self,
        session: AsyncSession,
        data: dict[str, Any],
        *,
        existing: object | None = None,
    ) -> dict[str, Any]:
        prepared = dict(data)
        exclude_id = getattr(existing, "id", None) if existing is not None else None
        label_field = self.crud.label_field if isinstance(self.crud.label_field, str) else None
        dictionary_name = (
            self.crud.dictionary_name if isinstance(self.crud.dictionary_name, str) else None
        )
        model = self.crud.model if isinstance(self.crud.model, type) else None

        if label_field and label_field in prepared and prepared[label_field] is not None:
            prepared[label_field] = normalize_dictionary_label(str(prepared[label_field]))
            if model is not None and dictionary_name:
                await assert_unique_dictionary_value(
                    session,
                    model,
                    getattr(model, label_field),
                    prepared[label_field],
                    dictionary_name=dictionary_name,
                    exclude_id=exclude_id,
                )

        if model is Auditor and "code" in prepared and prepared["code"] is not None:
            prepared["code"] = str(prepared["code"]).strip().upper()
            await assert_unique_dictionary_value(
                session,
                Auditor,
                Auditor.code,
                prepared["code"],
                dictionary_name="auditors",
                exclude_id=exclude_id,
            )
        return prepared

    async def _update_auditor(
        self,
        session: AsyncSession,
        auditor: Auditor,
        data: dict[str, Any],
    ) -> Auditor:
        old_code = auditor.code
        old_name = auditor.full_name
        prepared = await self._prepare_payload(session, data, existing=auditor)
        updated = await self.crud.update(session, auditor, prepared)
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
        data: dict[str, Any],
    ) -> Department:
        old_name = department.name
        if "name" in data and data["name"] is not None:
            normalized = normalize_dictionary_label(str(data["name"]))
            if old_name == UNSPECIFIED_AUDIT_OBJECT and normalized != old_name:
                raise DictionaryProtectedError(
                    dictionary="departments",
                    label=old_name,
                    action="переименовать",
                )
        prepared = await self._prepare_payload(session, data, existing=department)
        new_name = prepared.get("name")
        if new_name is not None and new_name != old_name:
            await replace_recommendation_audit_object_label(session, old_name, new_name)
        updated = await self.crud.update(session, department, prepared)
        await session.commit()
        return updated
