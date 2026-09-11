"""Service-layer dictionary validation: uniqueness and label normalization."""

from __future__ import annotations

import asyncio
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.core.exceptions import DuplicateDictionaryError
from app.models.auditors import Auditor
from app.schemas.auditors import AuditorCreate
from app.services.dictionary_service import DictionaryService


def _auditor(full_name: str, code: str = "TST") -> Auditor:
    item = Auditor(full_name=full_name, code=code)
    item.id = uuid4()
    return item


def _crud(model: type = Auditor) -> MagicMock:
    crud = MagicMock()
    crud.model = model
    crud.label_field = "full_name"
    crud.dictionary_name = "auditors"
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    return crud


class DictionaryServiceValidationTests(unittest.TestCase):
    def test_create_raises_on_duplicate_label(self) -> None:
        crud = _crud()
        service = DictionaryService(crud=crud, not_found="Аудитор не найден.")
        session = AsyncMock()

        async def run() -> None:
            with patch(
                "app.services.dictionary_validation.find_dictionary_duplicate_by_label",
                new_callable=AsyncMock,
                return_value=_auditor("Важник Д.С."),
            ):
                with self.assertRaises(DuplicateDictionaryError) as ctx:
                    await service.create(
                        session,
                        AuditorCreate(full_name="Важник Д.С.", code="VDS"),
                    )
            self.assertEqual(ctx.exception.dictionary, "auditors")
            crud.create.assert_not_awaited()
            session.commit.assert_not_awaited()

        asyncio.run(run())

    def test_create_normalizes_label_before_insert(self) -> None:
        crud = _crud()
        created = _auditor("Каракосова Е.Д.", "KED")
        crud.create = AsyncMock(return_value=created)
        service = DictionaryService(crud=crud, not_found="Аудитор не найден.")
        session = AsyncMock()

        async def run() -> None:
            with patch(
                "app.services.dictionary_validation.find_dictionary_duplicate_by_label",
                new_callable=AsyncMock,
                return_value=None,
            ):
                await service.create(
                    session,
                    AuditorCreate(full_name="  Каракосова   E.Д.  ", code="ked"),
                )
            payload = crud.create.await_args.args[1]
            self.assertEqual(payload["full_name"], "Каракосова Е.Д.")
            self.assertEqual(payload["code"], "KED")
            session.commit.assert_awaited_once()

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
