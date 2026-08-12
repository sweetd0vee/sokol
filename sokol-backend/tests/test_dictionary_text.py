"""Tests for dictionary label normalization."""

import unittest

from app.utils.dictionary_text import normalize_dictionary_label


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


if __name__ == "__main__":
    unittest.main()
