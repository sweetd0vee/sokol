"""Tests for dictionary label normalization."""

import unittest

from app.utils.dictionary_text import (
    dictionary_loose_match_key,
    find_dictionary_label_match,
    normalize_dictionary_label,
)


class DictionaryTextTests(unittest.TestCase):
    def test_latin_homoglyphs_to_cyrillic(self) -> None:
        self.assertEqual(
            normalize_dictionary_label("Харитонов A.И."),
            "Харитонов А.И.",
        )
        self.assertEqual(
            normalize_dictionary_label("Каракосова E.Д."),
            "Каракосова Е.Д.",
        )

    def test_collapses_whitespace(self) -> None:
        self.assertEqual(
            normalize_dictionary_label("  Важник   Д.С.  "),
            "Важник Д.С.",
        )

    def test_cyrillic_unchanged(self) -> None:
        self.assertEqual(
            normalize_dictionary_label("Харитонов А.И."),
            "Харитонов А.И.",
        )

    def test_loose_key_ignores_extra_symbols(self) -> None:
        self.assertEqual(
            dictionary_loose_match_key("Отдел закупок.!?"),
            dictionary_loose_match_key("Отдел закупок"),
        )

    def test_find_match_allows_small_typo(self) -> None:
        self.assertEqual(
            find_dictionary_label_match("Оттдел закупок", ["Отдел закупок"]),
            "Отдел закупок",
        )


if __name__ == "__main__":
    unittest.main()
