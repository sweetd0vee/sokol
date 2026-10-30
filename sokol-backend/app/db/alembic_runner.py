"""Run Alembic upgrades / stamp for existing stands.

Public entry: ``ensure_schema`` (used by ``init_db`` and Docker bootstrap).
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"
BASELINE_REVISION = "20260930_0001"


def alembic_config() -> Config:
    if not _ALEMBIC_INI.is_file():
        raise FileNotFoundError(f"alembic.ini not found: {_ALEMBIC_INI}")
    cfg = Config(str(_ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    return cfg


async def _table_exists(name: str) -> bool:
    async with engine.connect() as conn:
        result = await conn.scalar(
            text("SELECT to_regclass(:reg) IS NOT NULL"),
            {"reg": f"public.{name}"},
        )
    return bool(result)


async def ensure_schema() -> None:
    """Bring DB schema to Alembic head without wiping row data.

    - Empty DB → ``alembic upgrade head`` (baseline ``create_all`` from models).
    - Existing tables, no ``alembic_version`` → run legacy idempotent patches once,
      then ``stamp head`` (adopt schema; demo/real rows stay).
    - Already on Alembic → ``upgrade head`` (only new revisions).
    """
    cfg = alembic_config()
    has_version = await _table_exists("alembic_version")
    has_checks = await _table_exists("checks")

    if has_checks and not has_version:
        from app.db.migrations import run_all_migrations

        # Catch up old create_all stands to current columns/indexes, then adopt Alembic.
        await run_all_migrations(include_destructive=False)
        await asyncio.to_thread(command.stamp, cfg, "head")
        return

    await asyncio.to_thread(command.upgrade, cfg, "head")
