"""Unit tests for shared schema helpers."""

from __future__ import annotations

import unittest
from datetime import date

from pydantic import ValidationError

from app.schemas.auth import UserRead as AuthUserRead
from app.schemas.checks import CheckUpdate
from app.schemas.common import OptionalDate, parse_optional_date
from app.schemas.recommendations import RecommendationCreate, RecommendationUpdate
from app.schemas.users import UserRead
from app.utils.dictionary_text import normalize_audit_object_input


class ParseOptionalDateTests(unittest.TestCase):
    def test_blank_string_becomes_none(self) -> None:
        self.assertIsNone(parse_optional_date("  "))

    def test_iso_date_parses(self) -> None:
        self.assertEqual(parse_optional_date("2026-09-10"), date(2026, 9, 10))

    def test_invalid_date_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_optional_date("2026-13-32")


class SharedDateSchemaTests(unittest.TestCase):
    def test_optional_date_alias_is_annotated(self) -> None:
        self.assertTrue(hasattr(OptionalDate, "__metadata__"))

    def test_invalid_recommendation_deadline_is_422(self) -> None:
        with self.assertRaises(ValidationError):
            RecommendationUpdate(deadline="32.13.2026")

    def test_empty_recommendation_deadline_clears_field(self) -> None:
        payload = RecommendationUpdate(deadline="")
        self.assertIsNone(payload.deadline)

    def test_invalid_check_date_is_422(self) -> None:
        with self.assertRaises(ValidationError):
            CheckUpdate(end_date="32.13.2026")

    def test_empty_check_date_clears_field(self) -> None:
        payload = CheckUpdate(end_date="")
        self.assertIsNone(payload.end_date)

    def test_audit_object_string_splits(self) -> None:
        payload = RecommendationCreate(
            serial_number="26IVP1P1",
            name="Рекомендация",
            audit_object="Процесс; Риски",
            auditor="Иванов И.И.",
            manager="Петров П.П.",
            status="on_control",
            additional_status="on_control",
        )
        self.assertEqual(payload.audit_object, ["Процесс", "Риски"])


class SharedSchemaIdentityTests(unittest.TestCase):
    def test_auth_and_users_share_user_read(self) -> None:
        self.assertIs(AuthUserRead, UserRead)

    def test_normalize_audit_object_defaults_unspecified(self) -> None:
        self.assertEqual(normalize_audit_object_input(""), ["Не указан"])


if __name__ == "__main__":
    unittest.main()
