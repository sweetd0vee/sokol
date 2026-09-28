"""Unit tests for date-driven check status calculation."""

from __future__ import annotations

import os
import unittest
from datetime import date
from types import SimpleNamespace

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.models.checks import CheckStatus
from app.services.check_status import (
    apply_computed_status_to_check,
    choose_check_status,
    overlay_check_status,
)


TODAY = date(2026, 9, 28)


class CheckStatusCalcTests(unittest.TestCase):
    def test_dz_date_completes_the_check(self) -> None:
        status = choose_check_status(
            start_date=date(2026, 10, 1),
            dz_document_date=date(2026, 12, 1),
            today=TODAY,
        )
        self.assertEqual(status, CheckStatus.COMPLETED)

    def test_future_start_without_dz_is_planned(self) -> None:
        status = choose_check_status(
            start_date=date(2026, 10, 1),
            dz_document_date=None,
            today=TODAY,
        )
        self.assertEqual(status, CheckStatus.NOT_STARTED)

    def test_start_today_or_earlier_without_dz_is_in_progress(self) -> None:
        self.assertEqual(
            choose_check_status(start_date=TODAY, dz_document_date=None, today=TODAY),
            CheckStatus.IN_PROGRESS,
        )
        self.assertEqual(
            choose_check_status(
                start_date=date(2026, 9, 1),
                dz_document_date=None,
                today=TODAY,
            ),
            CheckStatus.IN_PROGRESS,
        )

    def test_end_date_does_not_complete_the_check(self) -> None:
        payload = overlay_check_status(
            {
                "start_date": date(2026, 8, 1),
                "end_date": date(2026, 8, 20),
                "status": CheckStatus.NOT_STARTED,
            },
            today=TODAY,
        )
        self.assertEqual(payload["status"], CheckStatus.IN_PROGRESS)

    def test_overlay_ignores_client_status_and_keeps_existing_dates(self) -> None:
        existing = SimpleNamespace(
            start_date=date(2026, 10, 5),
            dz_document_date=None,
            status=CheckStatus.IN_PROGRESS,
        )
        payload = overlay_check_status(
            {"check_name": "Переименована", "status": CheckStatus.COMPLETED},
            existing=existing,
            today=TODAY,
        )
        self.assertEqual(payload["status"], CheckStatus.NOT_STARTED)

    def test_clearing_dz_date_reopens_the_check(self) -> None:
        existing = SimpleNamespace(
            start_date=date(2026, 9, 1),
            dz_document_date=date(2026, 9, 20),
            status=CheckStatus.COMPLETED,
        )
        payload = overlay_check_status(
            {"dz_document_date": None},
            existing=existing,
            today=TODAY,
        )
        self.assertEqual(payload["status"], CheckStatus.IN_PROGRESS)

    def test_apply_writes_status_only_when_it_changes(self) -> None:
        unchanged = SimpleNamespace(
            start_date=date(2026, 10, 1),
            dz_document_date=None,
            status=CheckStatus.NOT_STARTED,
        )
        self.assertFalse(apply_computed_status_to_check(unchanged, today=TODAY))

        started = SimpleNamespace(
            start_date=date(2026, 9, 1),
            dz_document_date=None,
            status=CheckStatus.NOT_STARTED,
        )
        self.assertTrue(apply_computed_status_to_check(started, today=TODAY))
        self.assertEqual(started.status, CheckStatus.IN_PROGRESS)
