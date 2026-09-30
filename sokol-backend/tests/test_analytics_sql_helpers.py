"""Contract tests for analytics SQL literals and extension predicates."""

from __future__ import annotations

import os
import unittest
from datetime import date

from sqlalchemy.dialects import postgresql

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.models.checks import CheckStatus
from app.services.analytics.sql_aggregates.recommendations_sql import (
    _count_recommendation_deadline_extensions,
)
from app.services.analytics.sql_helpers import (
    bucket_date_from_row,
    check_status_count_columns,
    recommendation_has_extensions,
    recommendation_materiality_count_columns,
    recommendation_status_count_columns,
)
from app.services.analytics.values import completion_share, named_counts, pad_anchor_dates
from types import SimpleNamespace


def _compiled(expr: object) -> str:
    return str(expr.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


class AnalyticsSqlHelperTests(unittest.TestCase):
    def test_status_count_columns_use_enum_and_russian_free_literals(self) -> None:
        check_sql = " ".join(_compiled(column) for column in check_status_count_columns())
        # Check.status is a native PG enum without values_callable → member names.
        self.assertIn(CheckStatus.NOT_STARTED.name, check_sql)
        self.assertIn(CheckStatus.IN_PROGRESS.name, check_sql)
        self.assertIn(CheckStatus.COMPLETED.name, check_sql)

        rec_sql = " ".join(
            _compiled(column) for column in recommendation_status_count_columns()
        )
        for status in ("completed", "unresolved", "on_control", "in_progress"):
            self.assertIn(status, rec_sql)

        materiality_sql = " ".join(
            _compiled(column) for column in recommendation_materiality_count_columns()
        )
        for label in ("низкий", "средний", "высокий"):
            self.assertIn(label, materiality_sql)

    def test_extension_predicate_matches_chart_counter(self) -> None:
        sql = _compiled(recommendation_has_extensions())
        self.assertIn("json_array_length", sql.lower())
        self.assertIn("extension_2_reason", sql)
        self.assertIn("extension_1_date", sql)
        self.assertIn("deadline_extensions", sql)

    def test_extension_counter_ignores_empty_json_and_counts_legacy_second_date(self) -> None:
        self.assertEqual(
            _count_recommendation_deadline_extensions(
                deadline_extensions=[],
                extension_1_date=None,
                extension_1_comment=None,
                extension_2_reason=None,
                extension_2_comment=None,
            ),
            0,
        )
        self.assertEqual(
            _count_recommendation_deadline_extensions(
                deadline_extensions=None,
                extension_1_date=None,
                extension_1_comment=None,
                extension_2_reason="2026-12-01",
                extension_2_comment=None,
            ),
            1,
        )
        self.assertEqual(
            _count_recommendation_deadline_extensions(
                deadline_extensions=[
                    {"date": "2026-10-01", "comment": "Первый"},
                    {"date": "", "comment": ""},
                    {"date": "2026-12-01", "comment": "Второй"},
                ],
                extension_1_date=date(2026, 9, 1),
                extension_1_comment="ignored when JSON rows exist",
                extension_2_reason="2027-01-01",
                extension_2_comment=None,
            ),
            2,
        )

    def test_period_bucket_date_and_value_helpers(self) -> None:
        self.assertEqual(
            bucket_date_from_row(SimpleNamespace(bucket_year=2026, bucket_quarter=2), "quarter"),
            date(2026, 4, 1),
        )
        self.assertEqual(completion_share(0, 0), 0)
        self.assertEqual(completion_share(3, 1), 33)
        self.assertEqual(
            [item.name for item in named_counts({"Б": 1, "А": 1, "В": 5})],
            ["В", "А", "Б"],
        )
        padded = pad_anchor_dates([date(2024, 6, 1)])
        self.assertIn("2024-06-01", padded)
        self.assertIn("2025-01-01", padded)
        self.assertIn("2026-01-01", padded)
