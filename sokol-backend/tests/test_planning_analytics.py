"""Unit tests for planning analytics helpers."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.analytics import planning_analytics as planning
from app.services.analytics.common import (
    build_department_lookup,
    check_canonical_department_distribution,
    check_department_distribution,
    match_audit_object_to_departments,
    parse_audit_object_parts,
)


def _check(serial_number: str) -> SimpleNamespace:
    return SimpleNamespace(serial_number=serial_number)


def _recommendation(
    serial_number: str,
    audit_object: str | None,
    materiality_level: str = "средний",
) -> SimpleNamespace:
    return SimpleNamespace(
        serial_number=serial_number,
        audit_object=audit_object,
        materiality_level=materiality_level,
    )


class PlanningAnalyticsTests(unittest.TestCase):
    def test_check_department_distribution_counts_unique_departments(self) -> None:
        checks = [_check("SN-1"), _check("SN-2")]
        recommendations = [
            _recommendation("SN-1", "Финансы"),
            _recommendation("SN-1", "Финансы"),
            _recommendation("SN-1", "Риски"),
            _recommendation("SN-2", None),
        ]

        counts = check_department_distribution(checks, recommendations)

        self.assertEqual(counts["Финансы"], 1)
        self.assertEqual(counts["Риски"], 1)
        self.assertEqual(counts["Без департамента"], 1)

    def test_parse_audit_object_parts_splits_combined_values(self) -> None:
        self.assertEqual(
            parse_audit_object_parts("Архивный отдел; Департамент ИТ"),
            ["Архивный отдел", "Департамент ИТ"],
        )

    def test_check_canonical_department_distribution_uses_dictionary(self) -> None:
        departments = ["Финансы", "Риски", "ИТ"]
        lookup = build_department_lookup(departments)
        checks = [_check("SN-1")]
        recommendations = [
            _recommendation("SN-1", "Финансы; Риски"),
            _recommendation("SN-1", "Финансы"),
        ]

        matched = match_audit_object_to_departments("Финансы; Риски", lookup)
        self.assertEqual(matched, {"Финансы", "Риски"})

        counts = check_canonical_department_distribution(checks, recommendations, departments)
        self.assertEqual(counts["Финансы"], 1)
        self.assertEqual(counts["Риски"], 1)
        self.assertEqual(counts["ИТ"], 0)

    def test_match_audit_object_allows_extra_symbols_and_typos(self) -> None:
        lookup = build_department_lookup(["Отдел закупок"])

        self.assertEqual(
            match_audit_object_to_departments("Отдел закупок.; Оттдел закупок", lookup),
            {"Отдел закупок"},
        )

    def test_build_coverage_rates_and_lists(self) -> None:
        coverage = planning._build_coverage(
            all_departments=["А", "Б", "В"],
            check_counts={"А": 2, "Б": 0},
        )

        self.assertEqual(coverage.total, 3)
        self.assertEqual(coverage.covered, 1)
        self.assertEqual(coverage.uncovered, 2)
        self.assertEqual(coverage.coverage_rate, 33)
        self.assertEqual(coverage.covered_departments, ["А"])
        self.assertEqual(coverage.uncovered_departments, ["Б", "В"])

    def test_high_materiality_by_department_filters_and_sorts(self) -> None:
        lookup = build_department_lookup(["Финансы", "Риски"])
        recommendations = [
            ("SN-1", "Финансы", "высокий"),
            ("SN-2", "Финансы", "высокий"),
            ("SN-3", "Риски", "средний"),
            ("SN-4", "", "высокий"),
        ]

        ranking = planning._high_materiality_by_department(recommendations, lookup)

        self.assertEqual(ranking[0].name, "Финансы")
        self.assertEqual(ranking[0].value, 2)
        self.assertEqual(ranking[1].name, "Без департамента")
        self.assertEqual(ranking[1].value, 1)


if __name__ == "__main__":
    unittest.main()
