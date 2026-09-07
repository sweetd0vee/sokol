"""Unit tests for recommendation counts grouped by check view."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.analytics.sql_aggregates import recommendation_view_distribution_from_rows


class RecommendationViewDistributionTests(unittest.TestCase):
    def test_groups_blank_views_and_ranks_by_count(self) -> None:
        rows = [
            SimpleNamespace(name="ИТ", value=4),
            SimpleNamespace(name=" Корпо ", value=2),
            SimpleNamespace(name="", value=1),
            SimpleNamespace(name=None, value=2),
        ]

        result = recommendation_view_distribution_from_rows(rows)

        self.assertEqual(
            [(item.name, item.value) for item in result],
            [("ИТ", 4), ("Не указан", 3), ("Корпо", 2)],
        )
