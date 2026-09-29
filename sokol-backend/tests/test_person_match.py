"""Unit tests for person name matching helpers."""

from __future__ import annotations

import os
import unittest

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.core.person_match import person_field_matches_user
from app.core.recommendation_access import (
    user_can_create_recommendation,
    user_can_manage_check,
    user_can_manage_recommendation,
)
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

    def test_auditor_can_manage_check_as_leader_or_creator(self) -> None:
        self.assertTrue(
            user_can_manage_check(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                check_leader="Важник Дмитрий Сергеевич",
            )
        )
        self.assertTrue(
            user_can_manage_check(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                check_leader="Иванов И.И.",
                created_by="Важник Д.С.",
            )
        )
        self.assertFalse(
            user_can_manage_check(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                check_leader="Иванов И.И.",
                created_by="Петров П.П.",
            )
        )

    def test_admin_can_manage_any_check(self) -> None:
        self.assertTrue(
            user_can_manage_check(
                role=Role.ADMIN,
                username="Админ А.А.",
                check_leader="Иванов И.И.",
            )
        )

    def test_auditor_can_manage_recommendation_as_leader_or_creator(self) -> None:
        self.assertTrue(
            user_can_manage_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Иванов И.И.",
                check_leader="Важник Д.С.",
            )
        )
        self.assertTrue(
            user_can_manage_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Иванов И.И.",
                created_by="Важник Д.С.",
            )
        )
        self.assertTrue(
            user_can_manage_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Иванов И.И.",
                check_created_by="Важник Д.С.",
            )
        )
        self.assertFalse(
            user_can_manage_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Иванов И.И.",
                check_leader="Петров П.П.",
                created_by="Петров П.П.",
                check_created_by="Петров П.П.",
            )
        )

    def test_auditor_can_create_recommendation_on_own_check_or_as_auditor(self) -> None:
        self.assertTrue(
            user_can_create_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Иванов И.И.",
                check_leader="Важник Д.С.",
            )
        )
        self.assertTrue(
            user_can_create_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Важник Д.С.",
                check_leader="Иванов И.И.",
            )
        )
        self.assertFalse(
            user_can_create_recommendation(
                role=Role.AUDITOR,
                username="Важник Д.С.",
                auditor="Иванов И.И.",
                check_leader="Петров П.П.",
            )
        )

    def test_empty_values_do_not_match(self) -> None:
        self.assertFalse(person_field_matches_user("", "Важник Д.С."))
        self.assertFalse(person_field_matches_user("Важник Д.С.", "  "))

    def test_surname_only_user_matches_same_surname_field(self) -> None:
        self.assertTrue(person_field_matches_user("Иванов А.А.", "Иванов"))

    def test_surname_only_field_does_not_match_initials_user(self) -> None:
        self.assertFalse(person_field_matches_user("Иванов", "Иванов А.А."))

    def test_partial_initials_prefix_matches_full_name(self) -> None:
        self.assertTrue(
            person_field_matches_user(
                "Иванов Александр Александрович",
                "Иванов А.",
            )
        )

    def test_conflicting_initials_do_not_match(self) -> None:
        self.assertFalse(person_field_matches_user("Иванов А.А.", "Иванов Б.Б."))


if __name__ == "__main__":
    unittest.main()
