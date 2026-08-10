#!/bin/sh
set -eu

echo "Waiting for database..."
python - <<'PY'
import asyncio
import os
import sys
import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

url = os.environ.get("DATABASE_URL", "").strip()
if not url:
    print("DATABASE_URL is required", file=sys.stderr)
    sys.exit(1)

async def wait_db() -> None:
    engine = create_async_engine(url, pool_pre_ping=True)
    last_error = None
    for _ in range(60):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            await engine.dispose()
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(1)
    await engine.dispose()
    raise RuntimeError(f"Database is not ready: {last_error}")

asyncio.run(wait_db())
print("Database is ready.")
PY

python - <<'PY'
import asyncio
import os

from sqlalchemy import func, select

from app.db.init_db import init_db
from app.db.import_seed_data import import_seed_data
from app.db.migrate_check_effectiveness import migrate as migrate_effectiveness
from app.db.seed_audit_types import AUDIT_TYPES, seed_audit_types
from app.db.seed_auditors import AUDITORS, seed_auditors
from app.db.seed_check_kinds import CHECK_KINDS, seed_check_kinds
from app.db.seed_effectiveness_ratings import EFFECTIVENESS_RATINGS, seed_effectiveness_ratings
from app.db.session import AsyncSessionLocal
from app.models.checks import Check


async def bootstrap() -> None:
    await init_db()
    await migrate_effectiveness()
    await seed_audit_types(AUDIT_TYPES)
    await seed_auditors(AUDITORS)
    await seed_check_kinds(CHECK_KINDS)
    await seed_effectiveness_ratings(EFFECTIVENESS_RATINGS)

    load_demo = os.getenv("SOKOL_LOAD_DEMO_DATA", "1").strip().lower() not in {"0", "false", "no"}
    if not load_demo:
        print("SOKOL_LOAD_DEMO_DATA disabled — skip demo import.")
        return

    force_replace = os.getenv("SOKOL_SEED_REPLACE", "0").strip().lower() in {"1", "true", "yes"}
    async with AsyncSessionLocal() as session:
        count = int(await session.scalar(select(func.count()).select_from(Check)) or 0)
    if force_replace or count == 0:
        print("Loading demo data from Excel...")
        await import_seed_data(replace=force_replace)
    else:
        print(f"Checks already present ({count}) — skip demo import.")


asyncio.run(bootstrap())
print("Bootstrap completed.")
PY

exec "$@"
