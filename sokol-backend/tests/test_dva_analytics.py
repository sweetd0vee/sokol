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

    def test_document_readiness_lists_missing_checks_and_ranks_weakest_first(self) -> None:
        rows = [
            SimpleNamespace(
                name="Петров",
                serial_number="П-1",
                short_name="Полный комплект",
                check_name="Проверка 1",
                order_document_number="1",
                order_document_date=None,
                program_document_number="1",
                program_document_date=None,
                az_document_number="1",
                az_document_date=None,
                dz_document_number="1",
                dz_document_date=None,
            ),
            SimpleNamespace(
                name="Сидоров",
                serial_number="С-1",
                short_name="Без программы",
                check_name="Проверка 2",
                order_document_number="1",
                order_document_date=None,
                program_document_number=None,
                program_document_date=None,
                az_document_number=None,
                az_document_date=None,
                dz_document_number=None,
                dz_document_date=None,
            ),
            SimpleNamespace(
                name="Сидоров",
                serial_number="С-2",
                short_name="Пустая",
                check_name="Проверка 3",
                order_document_number=None,
                order_document_date=None,
                program_document_number=None,
                program_document_date=None,
                az_document_number=None,
                az_document_date=None,
                dz_document_number=None,
                dz_document_date=None,
            ),
        ]

        documents = dva_auditor_documents_from_rows(rows)

        self.assertEqual([row.name for row in documents], ["Сидоров", "Петров"])
        self.assertEqual(documents[0].readiness, 13)
        self.assertEqual([item.key for item in documents[0].missing_order], ["С-2"])
        self.assertEqual([item.key for item in documents[0].missing_program], ["С-1", "С-2"])
        self.assertEqual(documents[0].missing_program[0].short_name, "Без программы")
        self.assertEqual(documents[1].readiness, 100)
        self.assertEqual(documents[1].missing_dz, [])


if __name__ == "__main__":
    unittest.main()
