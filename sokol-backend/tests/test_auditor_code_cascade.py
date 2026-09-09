"""Unit tests for auditor-code cascade into check serial numbers."""

from __future__ import annotations

import asyncio
import os
import unittest
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.crud.auditors_crud import update_auditor
from app.models.auditors import Auditor
from app.models.checks import Check, CheckStatus
from app.schemas.auditors import AuditorUpdate
from app.services.check_serial_cascade import (
    SerialRewrite,
    replace_auditor_code_in_serial,
)


class ReplaceAuditorCodeInSerialTests(unittest.TestCase):
    def test_replaces_code_segment(self) -> None:
        self.assertEqual(
            replace_auditor_code_in_serial("26GEG1P1", "GEG", "ABC"),
            "26ABC1P1",
        )

    def test_returns_none_when_code_mismatch(self) -> None:
        self.assertIsNone(replace_auditor_code_in_serial("26XXX1P1", "GEG", "ABC"))


class UpdateAuditorCodeCascadeTests(unittest.TestCase):
    def test_update_auditor_rewrites_check_and_related_serials(self) -> None:
        session = AsyncMock()
        session.add = MagicMock()
        session.flush = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()

        auditor = Auditor(full_name="Гуль Е.Г.", code="GEG")
        auditor.id = uuid4()

        check = Check(
            id=42,
            check_name="Проверка",
            check_type="planned",
            check_view="Комплексная проверка",
            check_quarter=1,
            start_date=date(2026, 1, 15),
            end_date=None,
            check_leader="Гуль Е.Г.",
            status=CheckStatus.NOT_STARTED,
            created_at=date(2026, 1, 10),
            serial_number="26GEG1P1",
        )

        async def execute(statement):  # noqa: ANN001
            result = MagicMock()
            sql = str(statement).lower()
            if "from checks" in sql or "from checks" in sql.replace("\n", " "):
                # first select(Check) in cascade, second after rewrites for in_
                result.scalars.return_value = [check]
                result.scalars.return_value.all = lambda: [check]
                return result
            return result

        # Simpler: patch cascade helpers and find_dictionary_duplicate
        async def run() -> None:
            with (
                patch(
                    "app.crud.auditors_crud.find_dictionary_duplicate_by_label",
                    new_callable=AsyncMock,
                    return_value=None,
                ),
                patch(
                    "app.crud.auditors_crud.cascade_auditor_code_in_check_keys",
                    new_callable=AsyncMock,
                    return_value=[
                        SerialRewrite(
                            check_id=42,
                            old_serial="26GEG1P1",
                            new_serial="26ABC1P1",
                        )
                    ],
                ) as cascade,
                patch(
                    "app.crud.auditors_crud.cleanup_old_serial_buckets",
                    new_callable=AsyncMock,
                ) as cleanup,
            ):
                updated = await update_auditor(
                    session,
                    auditor,
                    AuditorUpdate(code="ABC"),
                )

            self.assertEqual(updated.code, "ABC")
            cascade.assert_awaited_once_with(
                session,
                check_leader="Гуль Е.Г.",
                old_code="GEG",
                new_code="ABC",
            )
            session.commit.assert_awaited_once()
            cleanup.assert_awaited_once()

        asyncio.run(run())

    def test_full_name_only_update_skips_code_cascade(self) -> None:
        session = AsyncMock()
        session.add = MagicMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        auditor = Auditor(full_name="Гуль Е.Г.", code="GEG")
        auditor.id = uuid4()

        async def run() -> None:
            with (
                patch(
                    "app.crud.auditors_crud.find_dictionary_duplicate_by_label",
                    new_callable=AsyncMock,
                    return_value=None,
                ),
                patch(
                    "app.crud.auditors_crud.cascade_auditor_code_in_check_keys",
                    new_callable=AsyncMock,
                ) as cascade,
                patch(
                    "app.crud.auditors_crud.cleanup_old_serial_buckets",
                    new_callable=AsyncMock,
                ) as cleanup,
            ):
                await update_auditor(
                    session,
                    auditor,
                    AuditorUpdate(full_name="Гуль Е.Г. (обновлён)"),
                )

            cascade.assert_not_awaited()
            cleanup.assert_not_awaited()
            session.commit.assert_awaited_once()

        asyncio.run(run())


class CascadeAuditorCodeInCheckKeysTests(unittest.TestCase):
    def test_rewrites_serials_and_cascades_related_rows(self) -> None:
        from app.services import check_serial_cascade as cascade_mod

        session = AsyncMock()
        session.flush = AsyncMock()
        storage = AsyncMock()

        check = Check(
            id=7,
            check_name="Проверка",
            check_type="planned",
            check_view="Комплексная проверка",
            check_quarter=2,
            start_date=date(2026, 4, 1),
            end_date=None,
            check_leader="Гуль Е.Г.",
            status=CheckStatus.NOT_STARTED,
            created_at=date(2026, 3, 1),
            serial_number="26GEG2P1",
        )

        async def execute(statement):  # noqa: ANN001
            result = MagicMock()
            result.scalars.return_value.all = lambda: [check]
            result.scalars.return_value = MagicMock(all=lambda: [check])
            return result

        session.execute = AsyncMock(side_effect=execute)

        async def run() -> None:
            with patch.object(cascade_mod, "get_storage", return_value=storage):
                rewrites = await cascade_mod.cascade_auditor_code_in_check_keys(
                    session,
                    check_leader="Гуль Е.Г.",
                    old_code="GEG",
                    new_code="XYZ",
                )

            self.assertEqual(len(rewrites), 1)
            self.assertEqual(rewrites[0].old_serial, "26GEG2P1")
            self.assertEqual(rewrites[0].new_serial, "26XYZ2P1")
            self.assertEqual(check.serial_number, "26XYZ2P1")
            storage.copy_check_bucket_objects.assert_awaited_once_with("26GEG2P1", "26XYZ2P1")
            # recommendation + attachment updates
            self.assertGreaterEqual(session.execute.await_count, 3)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
