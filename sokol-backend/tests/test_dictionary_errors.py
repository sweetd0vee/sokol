"""Unit tests for dictionary CRUD errors."""

import unittest

from app.crud.dictionary_errors import DuplicateDictionaryError


class DictionaryErrorsTests(unittest.TestCase):
    def test_duplicate_error_message(self) -> None:
        error = DuplicateDictionaryError(dictionary="auditors", label="Важник Д.С.")
        self.assertEqual(error.dictionary, "auditors")
        self.assertEqual(error.label, "Важник Д.С.")
        self.assertIn("Важник Д.С.", str(error))
        self.assertIn("auditors", str(error))


if __name__ == "__main__":
    unittest.main()
