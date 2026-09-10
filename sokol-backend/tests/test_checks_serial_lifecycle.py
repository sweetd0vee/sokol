"""Unit tests for check serial-number lifecycle side effects."""

from __future__ import annotations

import asyncio
import os
import unittest
from datetime import date
from unittest.mock import AsyncMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.models.checks import Check, CheckStatus
from app.schemas.checks import CheckUpdate
from app.services import checks_service
from app.services.check_serial_cascade import SerialRewrite


class ChecksSerialLifecycleTests(unittest.TestCase):
    def test_update_check_migrates_bucket_and_cascades_serial(self) -> None:
        session = AsyncMock()
        check = Check(
            id=1,
            check_name="Проверка",
            check_type="planned",
            check_view="Комплексная проверка",
            check_quarter=1,
            start_date=date(2026, 1, 15),
            end_date=None,
            check_leader="Иванов И.И.",
            status=CheckStatus.NOT_STARTED,
            created_at=date(2026, 1, 10),
            serial_number="26IVP1P1",
        )

        async def _apply_rewrites(_session, rewrites, *, commit: bool = False) -> None:
            check.serial_number = rewrites[0].new_serial

        async def run() -> None:
            with (
                patch(
                    "app.services.checks_service.get_check",
                    new_callable=AsyncMock,
                    return_value=check,
                ),
                patch(
                    "app.services.checks_service.validate_check_dictionary_fields",
                    new_callable=AsyncMock,
                ),
                patch(
                    "app.services.checks_service.checks_crud.update_check",
                    new_callable=AsyncMock,
                    return_value=check,
                ),
                patch(
                    "app.services.checks_service.generate_unique_check_serial_number",
                    new_callable=AsyncMock,
                    return_value="26PPP1P1",
                ),
                patch(
                    "app.services.checks_service.apply_serial_rewrites",
                    new_callable=AsyncMock,
                    side_effect=_apply_rewrites,
                ) as apply,
                patch(
                    "app.services.checks_service.cleanup_old_serial_buckets",
                    new_callable=AsyncMock,
                ) as cleanup,
            ):
                updated = await checks_service.update_check(
                    session,
                    1,
                    CheckUpdate(check_leader="Петров П.П."),
                )

            self.assertEqual(updated.serial_number, "26PPP1P1")
            apply.assert_awaited_once()
            rewrites = apply.await_args.args[1]
            self.assertEqual(
                rewrites,
                [
                    SerialRewrite(
                        check_id=1,
                        old_serial="26IVP1P1",
                        new_serial="26PPP1P1",
                    )
                ],
            )
            session.commit.assert_awaited_once()
            cleanup.assert_awaited_once_with(rewrites)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
