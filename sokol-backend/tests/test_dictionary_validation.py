"""Unit tests for dictionary reference validation."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock

from app.services.dictionary_validation import (
    DictionaryRefError,
    canonicalize_audit_objects,
    validate_check_dictionary_fields,
    validate_recommendation_dictionary_fields,
)


def _table_name(statement) -> str:  # noqa: ANN001
    froms = statement.get_final_froms()
    if not froms:
        return ""
    table = froms[0]
    return getattr(table, "name", str(table))


def _session_with_hits(hits: dict[str, bool]) -> AsyncMock:
    session = AsyncMock()

    async def execute(statement):  # noqa: ANN001
        result = MagicMock()
        table = _table_name(statement)
        if hits.get(table):
            item = MagicMock()
            if table == "auditors":
                item.full_name = "Важник Д.С."
            elif table == "check_kinds":
                item.label = "Корпо"
            elif table == "effectiveness_ratings":
                item.label = "удовлетворительно"
            result.scalars.return_value = [item]
        else:
            result.scalars.return_value = []
        return result

    session.execute.side_effect = execute
    return session


def _session_with_departments(names: list[str]) -> AsyncMock:
    session = AsyncMock()
    result = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = names
    result.scalars.return_value = scalars
    session.execute.return_value = result
    return session


class DictionaryValidationTests(unittest.TestCase):
    def test_check_rejects_unknown_leader(self) -> None:
        session = _session_with_hits(
            {"auditors": False, "check_kinds": True, "effectiveness_ratings": True}
        )

        async def run() -> None:
            with self.assertRaises(DictionaryRefError) as ctx:
                await validate_check_dictionary_fields(
                    session,
                    {
                        "check_leader": "Неизвестный",
                        "check_view": "Корпо",
                    },
                )
            self.assertEqual(ctx.exception.field, "check_leader")
            self.assertEqual(ctx.exception.dictionary, "auditors")

        asyncio.run(run())

    def test_check_rejects_unknown_view(self) -> None:
        session = _session_with_hits(
            {"auditors": True, "check_kinds": False, "effectiveness_ratings": True}
        )

        async def run() -> None:
            with self.assertRaises(DictionaryRefError) as ctx:
                await validate_check_dictionary_fields(
                    session,
                    {"check_view": "Неизвестный вид"},
                )
            self.assertEqual(ctx.exception.dictionary, "check_kinds")

        asyncio.run(run())

    def test_check_skips_empty_effectiveness(self) -> None:
        session = _session_with_hits(
            {"auditors": True, "check_kinds": True, "effectiveness_ratings": False}
        )

        async def run() -> None:
            await validate_check_dictionary_fields(
                session,
                {
                    "check_leader": "Важник Д.С.",
                    "check_view": "Корпо",
                    "process_effectiveness": None,
                    "svk_effectiveness": "  ",
                },
            )

        asyncio.run(run())

    def test_check_rejects_unknown_rating(self) -> None:
        session = _session_with_hits(
            {"auditors": True, "check_kinds": True, "effectiveness_ratings": False}
        )

        async def run() -> None:
            with self.assertRaises(DictionaryRefError) as ctx:
                await validate_check_dictionary_fields(
                    session,
                    {"process_effectiveness": "супер"},
                )
            self.assertEqual(ctx.exception.dictionary, "effectiveness_ratings")

        asyncio.run(run())

    def test_recommendation_rejects_unknown_auditor(self) -> None:
        session = _session_with_hits({"auditors": False})

        async def run() -> None:
            with self.assertRaises(DictionaryRefError) as ctx:
                await validate_recommendation_dictionary_fields(
                    session,
                    {"auditor": "Не указан", "manager": "Филианова О.В"},
                )
            self.assertEqual(ctx.exception.field, "auditor")

        asyncio.run(run())

    def test_recommendation_allows_manager_outside_auditors(self) -> None:
        session = _session_with_hits({"auditors": True})

        async def run() -> None:
            await validate_recommendation_dictionary_fields(
                session,
                {"auditor": "Важник Д.С.", "manager": "Филианова О.В"},
            )
            # manager must not trigger a second auditors lookup
            self.assertEqual(session.execute.await_count, 1)

        asyncio.run(run())

    def test_canonicalize_audit_objects_maps_spacing_and_hyphen_variants(self) -> None:
        session = _session_with_departments(["Департамент-1", "Департамент ИТ"])

        async def run() -> None:
            result = await canonicalize_audit_objects(
                session,
                ["департамент - 1", "Департамент ИТ"],
            )
            self.assertEqual(result, ["Департамент-1", "Департамент ИТ"])

        asyncio.run(run())

    def test_canonicalize_audit_objects_allows_extra_symbols_and_typos(self) -> None:
        session = _session_with_departments(["Отдел закупок", "Департамент ИТ"])

        async def run() -> None:
            result = await canonicalize_audit_objects(
                session,
                ["Отдел закупок.", "Оттдел закупок"],
            )
            self.assertEqual(result, ["Отдел закупок"])

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
