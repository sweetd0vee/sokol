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

from app.db.bootstrap import run_docker_bootstrap

asyncio.run(run_docker_bootstrap())
print("Bootstrap completed.")
PY

exec "$@"
