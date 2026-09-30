"""Unit tests for Alembic adoption helpers (no live database required for most)."""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.db.alembic_runner import BASELINE_REVISION, alembic_config, ensure_schema


class AlembicRunnerTests(unittest.TestCase):
    def test_alembic_ini_and_baseline_revision_exist(self) -> None:
        cfg = alembic_config()
        script_location = Path(cfg.get_main_option("script_location"))
        if not script_location.is_absolute():
            script_location = Path(cfg.config_file_name).resolve().parent / script_location
        versions = script_location / "versions"
        self.assertTrue(versions.is_dir())
        baseline = versions / "20260930_0001_baseline_schema.py"
        self.assertTrue(baseline.is_file())
        self.assertEqual(BASELINE_REVISION, "20260930_0001")
        text = baseline.read_text(encoding="utf-8")
        self.assertIn('revision: str = "20260930_0001"', text)
        self.assertIn("Base.metadata.create_all", text)

    def test_ensure_schema_stamps_legacy_stand(self) -> None:
        async def _run() -> None:
            with (
                patch("app.db.alembic_runner._table_exists", new_callable=AsyncMock) as exists,
                patch("app.db.alembic_runner.command.stamp") as stamp,
                patch("app.db.alembic_runner.command.upgrade") as upgrade,
                patch(
                    "app.db.migrations.run_all_migrations",
                    new_callable=AsyncMock,
                ) as run_all,
            ):
                exists.side_effect = [False, True]  # alembic_version, checks
                await ensure_schema()
                run_all.assert_awaited_once_with(include_destructive=False)
                stamp.assert_called_once()
                upgrade.assert_not_called()

        import asyncio

        asyncio.run(_run())

    def test_ensure_schema_upgrades_empty_or_alembic_stand(self) -> None:
        async def _run() -> None:
            with (
                patch("app.db.alembic_runner._table_exists", new_callable=AsyncMock) as exists,
                patch("app.db.alembic_runner.command.stamp") as stamp,
                patch("app.db.alembic_runner.command.upgrade") as upgrade,
            ):
                exists.side_effect = [False, False]  # empty DB
                await ensure_schema()
                upgrade.assert_called_once()
                stamp.assert_not_called()

        import asyncio

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
