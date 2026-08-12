"""Unit tests for analytics SQL filter builders."""

from __future__ import annotations

import unittest

from sqlalchemy.dialects import postgresql

from app.services.analytics.sql_filters import (
    check_filter_conditions,
    period_or_condition,
    recommendation_filter_conditions,
)
from app.models.checks import Check
from app.models.recommendations import Recommendation


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


if __name__ == "__main__":
    unittest.main()
