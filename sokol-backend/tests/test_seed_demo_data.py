"""Unit tests for the throwaway synthetic demo seeder (no live database)."""

from __future__ import annotations

import inspect
import os
import unittest
from datetime import date

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.db.demo_data import build_check_rows, build_recommendation_rows
from app.db.seed_demo_data import (
    check_from_demo_row,
    recommendation_from_demo_row,
    seed_demo_data,
)
from app.models.checks import CheckStatus


TODAY = date(2026, 9, 28)


class SeedDemoDataTests(unittest.TestCase):
    def test_replace_is_opt_in(self) -> None:
        self.assertFalse(inspect.signature(seed_demo_data).parameters["replace"].default)

    def test_check_from_demo_row_leaves_id_to_postgres(self) -> None:
        row = build_check_rows(1, today=TODAY)[0]
        check = check_from_demo_row(row)
        self.assertIsNone(check.id)
        self.assertEqual(check.serial_number, row["serial_number"])
        self.assertEqual(check.status, CheckStatus(row["status"]))

    def test_recommendation_from_demo_row_binds_check_id(self) -> None:
        checks = build_check_rows(1, today=TODAY)
        row = build_recommendation_rows(checks, 1, today=TODAY)[0]
        rec = recommendation_from_demo_row(row, check_id=42, audit_object=["ИТ"])
        self.assertIsNone(rec.id)
        self.assertEqual(rec.check_id, 42)
        self.assertEqual(rec.serial_number, row["serial_number"])
        self.assertEqual(rec.audit_object, ["ИТ"])


if __name__ == "__main__":
    unittest.main()
