"""Tests for check serial number generation."""

import unittest
from datetime import date

from app.utils.check_key import CheckKeySeed, assign_serial_numbers, generate_check_serial_number


class CheckKeyTests(unittest.TestCase):
    def test_increments_within_year_for_same_leader_and_type(self) -> None:
        existing = [
            CheckKeySeed(
                leader="Голубицкая А.О.",
                start_date=date(2026, 1, 2),
                check_type="planned",
            )
        ]

        serial = generate_check_serial_number(
            date(2026, 7, 26),
            3,
            "Голубицкая А.О.",
            "planned",
            existing,
        )

        self.assertEqual(serial, "26GAO3P2")

    def test_resets_sequence_on_new_year(self) -> None:
        existing = [
            CheckKeySeed(
                leader="Голубицкая А.О.",
                start_date=date(2025, 12, 15),
                check_type="planned",
            )
        ]

        serial = generate_check_serial_number(
            date(2026, 1, 2),
            1,
            "Голубицкая А.О.",
            "planned",
            existing,
        )

        self.assertEqual(serial, "26GAO1P1")

    def test_uses_persistent_auditor_code(self) -> None:
        serial = generate_check_serial_number(
            date(2026, 7, 26),
            4,
            "Голубицкая А.О.",
            "planned",
            [],
            leader_code="XYZ",
        )

        self.assertEqual(serial, "26XYZ4P1")

    def test_simplifies_multiletter_transliteration_to_three_letter_code(self) -> None:
        kharitonov = generate_check_serial_number(
            date(2026, 1, 1),
            2,
            "Харитонов А.И.",
            "planned",
            [],
        )
        yakubovich = generate_check_serial_number(
            date(2026, 1, 1),
            2,
            "Якубович В.В.",
            "planned",
            [],
        )

        self.assertEqual(kharitonov, "26KAI2P1")
        self.assertEqual(yakubovich, "26YVV2P1")

    def test_ignores_other_leader_or_type(self) -> None:
        existing = [
            CheckKeySeed(
                leader="Голубицкая А.О.",
                start_date=date(2026, 3, 1),
                check_type="unscheduled",
            ),
            CheckKeySeed(
                leader="Вяжник Д.С.",
                start_date=date(2026, 4, 1),
                check_type="planned",
            ),
        ]

        serial = generate_check_serial_number(
            date(2026, 6, 1),
            2,
            "Голубицкая А.О.",
            "planned",
            existing,
        )

        self.assertEqual(serial, "26GAO2P1")

    def test_assign_serial_numbers_increments_across_quarters(self) -> None:
        checks = [
            {
                "id": 1,
                "start_date": date(2026, 1, 2),
                "check_quarter": 1,
                "check_leader": "Голубицкая А.О.",
                "check_type": "planned",
            },
            {
                "id": 10,
                "start_date": date(2026, 7, 26),
                "check_quarter": 3,
                "check_leader": "Голубицкая А.О.",
                "check_type": "planned",
            },
        ]

        assigned = assign_serial_numbers(checks)

        self.assertEqual(assigned[0]["serial_number"], "26GAO1P1")
        self.assertEqual(assigned[1]["serial_number"], "26GAO3P2")


if __name__ == "__main__":
    unittest.main()
