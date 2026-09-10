"""Unit tests for checks analytics period helpers."""

import unittest
from datetime import date

from app.services.analytics.period import (
    get_period_bucket,
    is_date_in_any_selected_periods,
)


class ChecksAnalyticsPeriodTests(unittest.TestCase):
    def test_get_period_bucket_month_quarter_year(self):
        value = date(2025, 3, 15)

        month = get_period_bucket(value, "month")
        self.assertEqual(month.key, "2025-03")
        self.assertEqual(month.label, "01.03.2025")

        quarter = get_period_bucket(value, "quarter")
        self.assertEqual(quarter.key, "2025-Q1")
        self.assertIn("(Q1)", quarter.label)

        year = get_period_bucket(value, "year")
        self.assertEqual(year.key, "2025")
        self.assertEqual(year.label, "2025")

    def test_is_date_in_any_selected_periods_or_logic(self):
        value = date(2025, 8, 1)

        self.assertTrue(is_date_in_any_selected_periods(value, years=[], quarters=[], months=[]))
        self.assertTrue(is_date_in_any_selected_periods(value, years=["2025"], quarters=[], months=[]))
        self.assertFalse(is_date_in_any_selected_periods(value, years=["2024"], quarters=[], months=[]))
        self.assertTrue(
            is_date_in_any_selected_periods(
                value,
                years=["2024"],
                quarters=[],
                months=["2025-08"],
            )
        )


if __name__ == "__main__":
    unittest.main()
