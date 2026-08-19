"""Unit tests for dictionary CRUD errors."""

import unittest

from app.crud.dictionary_errors import (
    DictionaryInUseError,
    DictionaryProtectedError,
    DuplicateDictionaryError,
)


class DictionaryErrorsTests(unittest.TestCase):
    def test_duplicate_error_message(self) -> None:
        error = DuplicateDictionaryError(dictionary="auditors", label="Важник Д.С.")
        self.assertEqual(error.dictionary, "auditors")
        self.assertEqual(error.label, "Важник Д.С.")
        self.assertIn("Важник Д.С.", str(error))
        self.assertIn("auditors", str(error))

    def test_in_use_error_message(self) -> None:
        error = DictionaryInUseError(dictionary="auditors", label="Важник Д.С.")
        self.assertEqual(error.dictionary, "auditors")
        self.assertIn("Важник Д.С.", str(error))
        self.assertIn("используется", str(error))

    def test_protected_error_message(self) -> None:
        error = DictionaryProtectedError(
            dictionary="departments",
            label="Не указан",
            action="удалить",
        )
        self.assertIn("Не указан", str(error))
        self.assertIn("удалить", str(error))


if __name__ == "__main__":
    unittest.main()
