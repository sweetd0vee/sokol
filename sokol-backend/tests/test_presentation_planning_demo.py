"""Presentation demo keeps a realistic planning coverage gap."""

from __future__ import annotations

import random
import unittest
from collections import defaultdict

from app.db.catalogs import DEPARTMENTS
from app.db.demo_data import DEMO_UNCOVERED_DEPARTMENTS
from app.db.presentation_demo_data import (
    COVERABLE_DEPARTMENTS,
    PRESENTATION_TODAY,
    build_checks,
    build_recommendations,
)


def _audit_parts(value: str) -> list[str]:
    return [part.strip() for part in value.split(";") if part.strip()]


class PresentationPlanningDemoTests(unittest.TestCase):
    def test_checks_cover_four_to_five_departments_and_leave_a_gap(self) -> None:
        rng = random.Random(20261220)
        checks = build_checks(checks_2025=18, checks_2026=14, today=PRESENTATION_TODAY, rng=rng)
        recommendations = build_recommendations(checks, rng, PRESENTATION_TODAY)

        by_check: dict[str, set[str]] = defaultdict(set)
        for row in recommendations:
            by_check[row["serial_number"]].update(_audit_parts(row["audit_object"]))

        self.assertGreater(len(checks), 0)
        for serial, departments in by_check.items():
            self.assertTrue(
                4 <= len(departments) <= 5,
                f"{serial} covers {len(departments)} departments: {sorted(departments)}",
            )
            self.assertTrue(departments.isdisjoint(DEMO_UNCOVERED_DEPARTMENTS))

        covered = {name for departments in by_check.values() for name in departments}
        real_departments = [name for name in DEPARTMENTS if name != "Не указан"]
        uncovered = [name for name in real_departments if name not in covered]
        always_uncovered = [name for name in DEMO_UNCOVERED_DEPARTMENTS if name != "Не указан"]

        self.assertGreaterEqual(len(uncovered), 5)
        self.assertLessEqual(len(uncovered), 16)
        for name in always_uncovered:
            self.assertIn(name, uncovered)
        self.assertTrue(set(COVERABLE_DEPARTMENTS).issuperset(covered))

        unresolved_departments = {
            name
            for row in recommendations
            if row["status"] == "unresolved"
            for name in _audit_parts(row["audit_object"])
        }
        self.assertGreaterEqual(len(unresolved_departments), 4)


if __name__ == "__main__":
    unittest.main()
