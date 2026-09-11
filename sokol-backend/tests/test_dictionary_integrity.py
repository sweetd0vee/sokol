"""Unit tests for dictionary FK helpers and delete guards."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.core.exceptions import DictionaryInUseError, DictionaryProtectedError
from app.db.ensure_dictionary_refs import allocate_auditor_code
from app.models.auditors import Auditor
from app.models.check_kinds import CheckKind
from app.models.departments import Department
from app.models.effectiveness_ratings import EffectivenessRating
from app.services.dictionary_integrity import (
    dictionary_identity,
    normalize_optional_dictionary_label,
)
from app.services.dictionary_service import DictionaryCrud, DictionaryService
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT


class DictionaryIntegrityHelperTests(unittest.TestCase):
    def test_normalize_optional_dictionary_label_blank_to_none(self) -> None:
        self.assertIsNone(normalize_optional_dictionary_label(None))
        self.assertIsNone(normalize_optional_dictionary_label("  "))
        self.assertEqual(normalize_optional_dictionary_label(" эффективно "), "эффективно")

    def test_dictionary_identity_for_auditor_and_department(self) -> None:
        auditor = Auditor(full_name="Важник Д.С.", code="VDS")
        department = Department(name="Департамент ИТ")
        self.assertEqual(dictionary_identity(auditor), ("auditors", "Важник Д.С."))
        self.assertEqual(dictionary_identity(department), ("departments", "Департамент ИТ"))
        self.assertEqual(
            dictionary_identity(CheckKind(label="Корпо")),
            ("check_kinds", "Корпо"),
        )
        self.assertEqual(
            dictionary_identity(EffectivenessRating(label="эффективно")),
            ("effectiveness_ratings", "эффективно"),
        )

    def test_allocate_auditor_code_avoids_used_values(self) -> None:
        used = {"VDS", "KAI"}
        code = allocate_auditor_code("Важник Д.С.", used)
        self.assertEqual(len(code), 3)
        self.assertTrue(code.isalpha())
        self.assertNotIn(code, used)


class DictionaryServiceDeleteTests(unittest.TestCase):
    def test_delete_rejects_in_use_dictionary_item(self) -> None:
        auditor = Auditor(full_name="Иванов И.И.", code="III")
        auditor.id = uuid4()
        crud = DictionaryCrud(
            create=AsyncMock(),
            get=AsyncMock(return_value=auditor),
            list=AsyncMock(),
            count=AsyncMock(),
            update=AsyncMock(),
            delete=AsyncMock(),
            model=Auditor,
            dictionary_name="auditors",
            label_field="full_name",
        )
        service = DictionaryService(crud=crud, not_found="not found")

        async def run() -> None:
            with patch(
                "app.services.dictionary_service.dictionary_item_in_use",
                AsyncMock(return_value=True),
            ):
                with self.assertRaises(DictionaryInUseError):
                    await service.delete(AsyncMock(), auditor.id)
            crud.delete.assert_not_called()

        asyncio.run(run())

    def test_delete_rejects_unspecified_department(self) -> None:
        department = Department(name=UNSPECIFIED_AUDIT_OBJECT)
        department.id = uuid4()
        crud = DictionaryCrud(
            create=AsyncMock(),
            get=AsyncMock(return_value=department),
            list=AsyncMock(),
            count=AsyncMock(),
            update=AsyncMock(),
            delete=AsyncMock(),
            model=Department,
            dictionary_name="departments",
            label_field="name",
        )
        service = DictionaryService(crud=crud, not_found="not found")

        async def run() -> None:
            with self.assertRaises(DictionaryProtectedError):
                await service.delete(AsyncMock(), department.id)
            crud.delete.assert_not_called()

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
