"""Unit tests for login normalization."""

from __future__ import annotations

import unittest

from app.core.users import normalize_login


class NormalizeLoginTests(unittest.TestCase):
    def test_collapses_whitespace_and_casefolds(self) -> None:
        self.assertEqual(normalize_login("  Админ   А.А.  "), "админ а.а.")

    def test_latin_lookalikes_map_to_cyrillic(self) -> None:
        self.assertEqual(normalize_login("Админ A.A."), normalize_login("Админ А.А."))
        self.assertEqual(normalize_login("Admin"), "адмin")

    def test_blank_becomes_empty(self) -> None:
        self.assertEqual(normalize_login("   "), "")


if __name__ == "__main__":
    unittest.main()
