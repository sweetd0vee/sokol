"""Unit tests for analytics SQL filter builders."""

from __future__ import annotations

import unittest

from sqlalchemy.dialects import postgresql

from types import SimpleNamespace

from app.services.analytics.common import collect_analytics_auditors
from app.services.analytics.sql_filters import (
    audit_object_has_values,
    check_filter_conditions,
    period_or_condition,
    recommendation_filter_conditions,
)
from app.services.analytics.sql_aggregates import department_map_from_pairs
from app.models.checks import Check


class AnalyticsSqlFiltersTests(unittest.TestCase):
    def test_period_or_condition_uses_or_across_period_types(self) -> None:
        condition = period_or_condition(
            Check.start_date,
            years=["2025"],
            quarters=["2026-Q1"],
        )
        self.assertIsNotNone(condition)
        compiled = str(
            condition.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
        )
        self.assertIn("extract", compiled.lower())
        self.assertIn(" OR ", compiled.upper())

    def test_check_filter_conditions_include_start_date_and_auditor_exists(self) -> None:
        conditions = check_filter_conditions(auditors=["Иванов И.И."], years=["2025"])
        self.assertGreaterEqual(len(conditions), 2)
        combined = " ".join(
            str(item.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
            for item in conditions
        )
        self.assertIn("start_date", combined)
        self.assertIn("check_leader", combined)
        self.assertIn("auditor", combined)
        self.assertNotIn("manager", combined)

    def test_recommendation_filter_conditions_include_deadline_and_status(self) -> None:
        conditions = recommendation_filter_conditions(
            statuses=["completed"],
            materiality_levels=["высокий"],
            months=["2025-03"],
        )
        compiled_parts = [
            str(item.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
            for item in conditions
        ]
        combined = " ".join(compiled_parts)
        self.assertIn("deadline", combined)
        self.assertIn("status", combined)
        self.assertIn("materiality_level", combined)

    def test_audit_object_has_values_uses_array_cardinality(self) -> None:
        condition = audit_object_has_values()
        compiled = str(
            condition.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
        )

        self.assertIn("audit_object IS NOT NULL", compiled)
        self.assertIn("cardinality", compiled)
        self.assertNotIn("!= ''", compiled)

    def test_department_map_respects_selected_departments_and_empty_checks(self) -> None:
        rows = department_map_from_pairs(
            [
                (1, ["ИТ", "Финансы"]),
                (2, []),
                (3, ["Юристы"]),
            ]
        )
        self.assertEqual(
            {item.name: item.value for item in rows},
            {"Без департамента": 1, "ИТ": 1, "Финансы": 1, "Юристы": 1},
        )

        selected_rows = department_map_from_pairs(
            [
                (1, ["ИТ", "Финансы"]),
                (2, ["Финансы"]),
                (3, ["Юристы"]),
            ],
            selected_departments=["ИТ"],
        )
        self.assertEqual([(item.name, item.value) for item in selected_rows], [("ИТ", 1)])

    def test_department_map_counts_checks_not_recommendations(self) -> None:
        rows = department_map_from_pairs(
            [
                (1, ["ИТ"]),
                (1, ["ИТ"]),
                (1, ["Финансы"]),
                (2, ["ИТ", "Финансы"]),
            ]
        )
        self.assertEqual(
            {item.name: item.value for item in rows},
            {"ИТ": 2, "Финансы": 2},
        )

    def test_collect_analytics_auditors_excludes_recommendation_managers(self) -> None:
        auditors = collect_analytics_auditors(
            [SimpleNamespace(check_leader="Ярмошевич И.Н")],
            [
                SimpleNamespace(
                    auditor="Якубович В.В.",
                    manager="Ярмошевич И.Н., Лавренюк Р.А",
                )
            ],
        )
        self.assertEqual(auditors, ["Якубович В.В.", "Ярмошевич И.Н"])


if __name__ == "__main__":
    unittest.main()
