"""Unit tests for DVA employee analytics mappings."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.analytics.sql_aggregates import (
    dva_auditor_documents_from_rows,
    dva_recommendation_profiles_from_rows,
)


class DvaAnalyticsMappingTests(unittest.TestCase):
    def test_recommendation_profiles_rank_by_impact_open_items_and_violations(self) -> None:
        rows = [
            SimpleNamespace(
                name=" Иванов ",
                total=10,
                low=2,
                medium=3,
                high=5,
                completed=4,
                in_progress=1,
                on_control=2,
                unresolved=3,
                on_time=6,
                deadline_violated=3,
                add_on_control=1,
            ),
            SimpleNamespace(
                name="",
                total=4,
                low=4,
                medium=0,
                high=0,
                completed=4,
                in_progress=0,
                on_control=0,
                unresolved=0,
                on_time=4,
                deadline_violated=0,
                add_on_control=0,
            ),
        ]

        impact, execution, timeliness = dva_recommendation_profiles_from_rows(rows)

        self.assertEqual([row.name for row in impact], ["Иванов", "Без аудитора"])
        self.assertEqual(impact[0].high, 5)
        self.assertEqual(execution[0].unresolved, 3)
        self.assertEqual(timeliness[0].violation_rate, 30)
        self.assertEqual(timeliness[1].name, "Без аудитора")

    def test_document_readiness_puts_weakest_auditors_first(self) -> None:
        rows = [
            SimpleNamespace(
                name="Петров",
                checks=2,
                order_filled=2,
                program_filled=2,
                az_filled=2,
                dz_filled=2,
            ),
            SimpleNamespace(
                name="Сидоров",
                checks=2,
                order_filled=1,
                program_filled=0,
                az_filled=0,
                dz_filled=0,
            ),
        ]

        documents = dva_auditor_documents_from_rows(rows)

        self.assertEqual([row.name for row in documents], ["Сидоров", "Петров"])
        self.assertEqual(documents[0].readiness, 13)
        self.assertEqual(documents[1].readiness, 100)


if __name__ == "__main__":
    unittest.main()
