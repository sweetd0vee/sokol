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

if [ -n "${SOKOL_MINIO_ENDPOINT:-}" ]; then
  echo "Waiting for MinIO at ${SOKOL_MINIO_ENDPOINT}..."
  python - <<'PY'
import os
import sys
import time
import urllib.error
import urllib.request

endpoint = os.environ.get("SOKOL_MINIO_ENDPOINT", "").strip()
if not endpoint:
    sys.exit(0)

host = endpoint.split(":")[0]
port = endpoint.split(":")[1] if ":" in endpoint else "9000"
url = f"http://{host}:{port}/minio/health/live"

last_error = None
for _ in range(60):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            if response.status == 200:
                print("MinIO is ready.")
                sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        last_error = exc
        time.sleep(1)

raise RuntimeError(f"MinIO is not ready: {last_error}")
PY
fi

python - <<'PY'
import asyncio
import os

from sqlalchemy import func, select

from app.core.config import settings
from app.core.startup_validation import (
    assert_demo_data_safe_for_env,
    assert_seed_replace_safe_for_env,
    env_flag_enabled,
)
from app.db.init_db import init_db
from app.db.import_seed_data import import_seed_data
from app.db.migrate_auditor_codes import migrate as migrate_auditor_codes
from app.db.migrate_analytics_indexes import migrate as migrate_analytics_indexes
from app.db.migrate_attachments import migrate as migrate_attachments
from app.db.migrate_check_effectiveness import migrate as migrate_effectiveness
from app.db.migrate_check_quarter import migrate as migrate_check_quarter
from app.db.migrate_dictionary_uniqueness import migrate as migrate_dictionary_uniqueness
from app.db.migrate_dictionary_foreign_keys import migrate as migrate_dictionary_foreign_keys
from app.db.migrate_recommendation_observation_name import migrate as migrate_recommendation_observation_name
from app.db.seed_audit_types import AUDIT_TYPES, seed_audit_types
from app.db.seed_check_kinds import CHECK_KINDS, seed_check_kinds
from app.db.seed_effectiveness_ratings import EFFECTIVENESS_RATINGS, seed_effectiveness_ratings
from app.db.sync_dictionaries import sync_auditors, sync_departments, sync_users
from app.db.session import AsyncSessionLocal
from app.db.sync_check_buckets import sync_check_buckets
from app.models.checks import Check


async def bootstrap() -> None:
    await init_db()
    await migrate_auditor_codes()
    await migrate_check_quarter()
    await migrate_effectiveness()
    await migrate_attachments()
    await migrate_dictionary_uniqueness()
    await migrate_dictionary_foreign_keys()
    await migrate_recommendation_observation_name()
    await migrate_analytics_indexes()
    await seed_audit_types(AUDIT_TYPES)
    await seed_check_kinds(CHECK_KINDS)
    await seed_effectiveness_ratings(EFFECTIVENESS_RATINGS)
    auditors_added, auditors_removed = await sync_auditors()
    departments_added, departments_removed = await sync_departments()
    users_added, users_removed = await sync_users()
    print(
        f"Synced dictionaries: auditors +{auditors_added}/-{auditors_removed}, "
        f"departments +{departments_added}/-{departments_removed}, "
        f"users +{users_added}/-{users_removed}"
    )
    await sync_check_buckets()

    load_demo = env_flag_enabled(os.getenv("SOKOL_LOAD_DEMO_DATA"), default=True)
    force_replace = env_flag_enabled(os.getenv("SOKOL_SEED_REPLACE"), default=False)
    assert_demo_data_safe_for_env(env=settings.sokol_env, load_demo=load_demo)
    assert_seed_replace_safe_for_env(env=settings.sokol_env, replace=force_replace)
    if not load_demo:
        print("SOKOL_LOAD_DEMO_DATA disabled — skip demo import.")
        return

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
