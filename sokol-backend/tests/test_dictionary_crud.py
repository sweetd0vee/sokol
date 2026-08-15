"""Unit tests for shared dictionary CRUD helpers."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.crud.dictionary_crud import (
    create_dictionary_item,
    find_dictionary_duplicate_by_label,
)
from app.crud.dictionary_errors import DuplicateDictionaryError
from app.models.auditors import Auditor


def _auditor(full_name: str) -> Auditor:
    item = Auditor(full_name=full_name, code="TEST")
    item.id = uuid4()
    return item


def _session_with_auditors(auditors: list[Auditor]) -> AsyncMock:
    session = AsyncMock()

    async def execute(_statement):  # noqa: ANN001
        result = MagicMock()
        result.scalars.return_value = auditors
        return result

    session.execute.side_effect = execute
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.add = MagicMock()
    return session


class DictionaryCrudTests(unittest.TestCase):
    def test_find_duplicate_detects_normalized_label(self) -> None:
        session = _session_with_auditors([_auditor("Харитонов A.И.")])

        async def run() -> None:
            duplicate = await find_dictionary_duplicate_by_label(
                session,
                Auditor,
                Auditor.full_name,
                "Харитонов А.И.",
            )
            self.assertIsNotNone(duplicate)

        asyncio.run(run())

    def test_create_raises_on_duplicate(self) -> None:
        session = _session_with_auditors([_auditor("Важник Д.С.")])

        async def run() -> None:
            with self.assertRaises(DuplicateDictionaryError) as ctx:
                await create_dictionary_item(
                    session,
                    Auditor,
                    {"full_name": "Важник Д.С.", "code": "VDS"},
                    label_field="full_name",
                    dictionary_name="auditors",
                )
            self.assertEqual(ctx.exception.dictionary, "auditors")

        asyncio.run(run())

    def test_create_normalizes_label_before_insert(self) -> None:
        session = _session_with_auditors([])

        async def run() -> None:
            await create_dictionary_item(
                session,
                Auditor,
                {"full_name": "  Каракосова   E.Д.  ", "code": "KED"},
                label_field="full_name",
                dictionary_name="auditors",
            )
            added = session.add.call_args[0][0]
            self.assertEqual(added.full_name, "Каракосова Е.Д.")

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
