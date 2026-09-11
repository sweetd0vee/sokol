"""Registry and CLI tests for the unified migrations package."""

from __future__ import annotations

import os
import unittest
from io import StringIO
from unittest.mock import patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.db.migrations import ALL_MIGRATIONS, BOOTSTRAP_MIGRATIONS, get_migration
from app.db.migrations.__main__ import main


BOOTSTRAP_NAMES = (
    "auditor_codes",
    "check_quarter",
    "check_effectiveness",
    "attachments",
    "dictionary_uniqueness",
    "recommendation_execution_deadline",
    "dictionary_foreign_keys",
    "recommendation_observation_name",
    "recommendation_indicator_on_control",
    "recommendation_additional_indicator",
    "analytics_indexes",
)


class MigrationsRegistryTests(unittest.TestCase):
    def test_names_are_unique(self) -> None:
        names = [item.name for item in ALL_MIGRATIONS]
        self.assertEqual(names, sorted(set(names), key=names.index))

    def test_bootstrap_order(self) -> None:
        bootstrap = tuple(item.name for item in ALL_MIGRATIONS if item.in_bootstrap)
        self.assertEqual(bootstrap, BOOTSTRAP_NAMES)
        self.assertEqual(len(BOOTSTRAP_MIGRATIONS), len(BOOTSTRAP_NAMES))

    def test_get_migration_unknown(self) -> None:
        with self.assertRaises(KeyError):
            get_migration("does_not_exist")

    def test_destructive_patch_is_opt_in(self) -> None:
        item = get_migration("recommendation_indicators")
        self.assertTrue(item.rewrites_data)
        self.assertFalse(item.in_bootstrap)

    def test_cli_list(self) -> None:
        with patch("sys.stdout", new_callable=StringIO) as stdout:
            code = main(["--list"])
        self.assertEqual(code, 0)
        output = stdout.getvalue()
        self.assertIn("auditor_codes", output)
        self.assertIn("recommendation_indicators", output)

    def test_cli_rejects_combined_flags(self) -> None:
        self.assertEqual(main(["--list", "--bootstrap"]), 2)

    def test_cli_unknown_name(self) -> None:
        with patch("sys.stderr", new_callable=StringIO) as stderr:
            code = main(["not-a-migration"])
        self.assertEqual(code, 2)
        self.assertIn("Unknown migration", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
