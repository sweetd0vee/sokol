"""Unit tests for person name matching helpers."""

from __future__ import annotations

import os
import unittest

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.core.person_match import person_field_matches_user
from app.core.recommendation_access import user_can_manage_recommendation
from app.core.roles import Role


class PersonMatchTests(unittest.TestCase):
    def test_exact_match_is_case_insensitive(self) -> None:
        self.assertTrue(person_field_matches_user("Важник Д.С.", "важник д.с."))

    def test_short_name_matches_full_name(self) -> None:
        self.assertTrue(
            person_field_matches_user(
                "Важник Дмитрий Сергеевич",
                "Важник Д.С.",
            )
        )

    def test_different_auditors_do_not_match(self) -> None:
        self.assertFalse(person_field_matches_user("Иванов И.И.", "Важник Д.С."))

    def test_admin_can_manage_any_recommendation(self) -> None:
        self.assertTrue(
            user_can_manage_recommendation(
                role=Role.ADMIN,
                username="Админ А.А.",
                auditor="Иванов И.И.",
            )
        )

    def test_department_head_can_manage_any_recommendation(self) -> None:
        self.assertTrue(
            user_can_manage_recommendation(
                role=Role.DEPARTMENT_HEAD,
                username="Ковалев С.С.",
                auditor="Иванов И.И.",
            )
        )

    def test_auditor_can_manage_only_own_recommendation(self) -> None:
        self.assertTrue(
            user_can_manage_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Важник Дмитрий Сергеевич",
            )
        )
        self.assertFalse(
            user_can_manage_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Иванов И.И.",
            )
        )


if __name__ == "__main__":
    unittest.main()
