"""Unit tests for check serial-number lifecycle side effects."""

from __future__ import annotations

import asyncio
import os
import unittest
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.crud import checks_crud
from app.models.checks import Check, CheckStatus
from app.schemas.checks import CheckUpdate


class ChecksSerialLifecycleTests(unittest.TestCase):
    def test_update_check_migrates_bucket_and_cascades_serial(self) -> None:
        session = AsyncMock()
        session.add = MagicMock()
        storage = AsyncMock()
        check = Check(
            id=1,
            check_name="Проверка",
            check_type="planned",
            check_view="Комплексная проверка",
            start_date=date(2026, 1, 15),
            end_date=None,
            check_leader="Иванов И.И.",
            status=CheckStatus.NOT_STARTED,
            created_at=date(2026, 1, 10),
            serial_number="26IVP01P1",
        )

        async def run() -> None:
            with (
                patch(
                    "app.crud.checks_crud.validate_check_dictionary_fields",
                    new_callable=AsyncMock,
                ),
                patch(
                    "app.crud.checks_crud._generate_unique_check_serial_number",
                    new_callable=AsyncMock,
                    return_value="26PPP01P1",
                ),
                patch("app.crud.checks_crud.get_storage", return_value=storage),
            ):
                updated = await checks_crud.update_check(
                    session,
                    check,
                    CheckUpdate(check_leader="Петров П.П."),
                )

            self.assertEqual(updated.serial_number, "26PPP01P1")
            storage.copy_check_bucket_objects.assert_awaited_once_with("26IVP01P1", "26PPP01P1")
            storage.delete_check_bucket.assert_awaited_once_with("26IVP01P1")
            self.assertEqual(session.execute.await_count, 2)
            session.commit.assert_awaited_once()
            session.refresh.assert_awaited_once_with(check)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
