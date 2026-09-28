"""Demo rows stay consistent with the date-driven status rules."""

from __future__ import annotations

import os
import random
import unittest
from datetime import date

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.db.demo_data import build_check_rows, build_recommendation_rows
from app.db.presentation_demo_data import PRESENTATION_TODAY, build_checks, build_recommendations
from app.services.check_status import choose_check_status
from app.services.recommendation_status import overlay_computed_status_fields


TODAY = date(2026, 9, 28)


def _status_value(value: object) -> str:
    return getattr(value, "value", value)


class DemoStatusAlignmentTests(unittest.TestCase):
    def test_synthetic_checks_match_dz_and_start_rules(self) -> None:
        rows = build_check_rows(40, today=TODAY)
        seen = {row["status"] for row in rows}
        self.assertEqual(seen, {"not_started", "in_progress", "completed"})
        for row in rows:
            expected = choose_check_status(
                start_date=row["start_date"],
                dz_document_date=row.get("dz_document_date"),
                today=TODAY,
            ).value
            self.assertEqual(row["status"], expected)
            if row["status"] == "completed":
                self.assertIsNotNone(row["dz_document_date"])
            else:
                self.assertIsNone(row["dz_document_date"])

    def test_synthetic_recommendations_match_auto_status(self) -> None:
        checks = build_check_rows(12, today=TODAY)
        rows = build_recommendation_rows(checks, 48, today=TODAY)
        seen = {row["status"] for row in rows}
        self.assertTrue({"completed", "unresolved", "on_control", "in_progress"} <= seen)
        for row in rows:
            stamped = overlay_computed_status_fields(dict(row), today=TODAY)
            self.assertEqual(row["status"], _status_value(stamped["status"]))
            self.assertEqual(row["additional_status"], _status_value(stamped["additional_status"]))
            self.assertEqual(row["indicator"], stamped["indicator"])
            self.assertEqual(row["additional_indicator"], stamped["additional_indicator"])

    def test_presentation_dataset_matches_its_clock(self) -> None:
        rng = random.Random(20261220)
        checks = build_checks(checks_2025=4, checks_2026=3, today=PRESENTATION_TODAY, rng=rng)
        recommendations = build_recommendations(checks, rng, PRESENTATION_TODAY)
        for row in checks:
            expected = choose_check_status(
                start_date=row["start_date"],
                dz_document_date=row.get("dz_document_date"),
                today=PRESENTATION_TODAY,
            ).value
            self.assertEqual(row["status"], expected)
        for row in recommendations:
            stamped = overlay_computed_status_fields(dict(row), today=PRESENTATION_TODAY)
            self.assertEqual(row["status"], _status_value(stamped["status"]))
            self.assertEqual(row["additional_status"], _status_value(stamped["additional_status"]))
