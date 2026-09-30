"""Unit tests for import --strict / --dry-run dictionary checks."""

from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.db.import_seed_data import import_seed_data


class ImportSeedStrictDryRunTests(unittest.IsolatedAsyncioTestCase):
    async def test_dry_run_does_not_ensure_or_insert(self) -> None:
        with (
            patch("app.db.import_seed_data.init_db", new_callable=AsyncMock),
            patch("app.db.import_seed_data.read_sheet_rows", side_effect=[[{"check_view": "X"}], []]),
            patch("app.db.import_seed_data.AsyncSessionLocal") as session_local,
            patch(
                "app.db.import_seed_data.find_missing_auditor_names",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "app.db.import_seed_data.find_missing_check_kind_labels",
                new_callable=AsyncMock,
                return_value=["X"],
            ),
            patch(
                "app.db.import_seed_data.find_missing_effectiveness_labels",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "app.db.import_seed_data.find_missing_department_names",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch("app.db.import_seed_data.ensure_auditor_names", new_callable=AsyncMock) as ensure,
            patch("app.db.import_seed_data.Path.is_file", return_value=True),
        ):
            session = AsyncMock()
            session_cm = MagicMock()
            session_cm.__aenter__ = AsyncMock(return_value=session)
            session_cm.__aexit__ = AsyncMock(return_value=None)
            session_local.return_value = session_cm

            await import_seed_data(dry_run=True)
            ensure.assert_not_called()

    async def test_strict_raises_on_missing_labels(self) -> None:
        with (
            patch("app.db.import_seed_data.init_db", new_callable=AsyncMock),
            patch("app.db.import_seed_data.read_sheet_rows", side_effect=[[{"check_view": "X"}], []]),
            patch("app.db.import_seed_data.AsyncSessionLocal") as session_local,
            patch(
                "app.db.import_seed_data.find_missing_auditor_names",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "app.db.import_seed_data.find_missing_check_kind_labels",
                new_callable=AsyncMock,
                return_value=["X"],
            ),
            patch(
                "app.db.import_seed_data.find_missing_effectiveness_labels",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "app.db.import_seed_data.find_missing_department_names",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch("app.db.import_seed_data.Path.is_file", return_value=True),
        ):
            session = AsyncMock()
            session_cm = MagicMock()
            session_cm.__aenter__ = AsyncMock(return_value=session)
            session_cm.__aexit__ = AsyncMock(return_value=None)
            session_local.return_value = session_cm

            with self.assertRaises(ValueError) as ctx:
                await import_seed_data(strict=True)
            self.assertIn("--strict", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
