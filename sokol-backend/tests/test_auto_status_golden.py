"""Frontend and backend share docs/fixtures/auto_status_golden.json."""

from __future__ import annotations

import json
import os
import unittest
from datetime import date
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.services.recommendation_status import compute_auto_status_fields

FIXTURE = Path(__file__).resolve().parents[2] / "docs" / "fixtures" / "auto_status_golden.json"


def _as_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


class AutoStatusGoldenTests(unittest.TestCase):
    def test_python_engine_matches_shared_fixture(self) -> None:
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
        today = date.fromisoformat(payload["today"])
        self.assertGreaterEqual(len(payload["cases"]), 10)

        for case in payload["cases"]:
            with self.subTest(case["id"]):
                inp = case["input"]
                result = compute_auto_status_fields(
                    control_deadline=_as_date(inp["controlDeadline"]),
                    execution_date=_as_date(inp["executionDate"]),
                    removed_from_control=bool(inp["removedFromControl"]),
                    current_indicator=inp["currentIndicator"],
                    today=today,
                )
                expected = case["expected"]
                if expected is None:
                    self.assertEqual(result, {})
                    continue
                self.assertEqual(result["status"].value, expected["status"])
                self.assertEqual(result["indicator"], expected["indicator"])
                self.assertEqual(result["additional_status"].value, expected["additionalStatus"])
                self.assertEqual(result["additional_indicator"], expected["additionalIndicator"])
