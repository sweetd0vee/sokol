#!/bin/bash
set -euo pipefail

# Destructive. Stop api/ui first:
#   docker compose stop api ui
#   docker compose run --rm -e SOKOL_RESTORE_CONFIRM=I_UNDERSTAND backup /opt/sokol-backup/restore.sh 2026-09-30T021500Z
#   docker compose start api ui

BACKUP_ROOT="${SOKOL_BACKUP_DIR:-/backups}"
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-postgres}"
PGDATABASE="${POSTGRES_DB:-sokol_db}"
export SOKOL_MINIO_ENDPOINT="${SOKOL_MINIO_ENDPOINT:-minio:9000}"
export MINIO_ROOT_USER="${MINIO_ROOT_USER:-${SOKOL_MINIO_ACCESS_KEY:-sokol}}"
export MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-${SOKOL_MINIO_SECRET_KEY:?MINIO_ROOT_PASSWORD is required}}"
export SOKOL_MINIO_SECURE="${SOKOL_MINIO_SECURE:-0}"
STAMP="${1:-}"

if [[ "${SOKOL_RESTORE_CONFIRM:-}" != "I_UNDERSTAND" ]]; then
  echo "Set SOKOL_RESTORE_CONFIRM=I_UNDERSTAND to restore. This replaces Postgres and MinIO." >&2
  exit 2
fi
if [[ -z "${STAMP}" ]]; then
  echo "Usage: restore.sh YYYY-MM-DDTHHMMSSZ" >&2
  exit 2
fi

SRC="${BACKUP_ROOT}/${STAMP}"
DUMP="${SRC}/postgres.dump"
if [[ ! -f "${DUMP}" ]]; then
  echo "snapshot not found: ${SRC}" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
pg_restore \
  -h "${PGHOST}" \
  -p "${PGPORT}" \
  -U "${PGUSER}" \
  -d "${PGDATABASE}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --exit-on-error \
  "${DUMP}"

python3 /opt/sokol-backup/minio_sync.py restore "${SRC}/minio" >/dev/null

echo "restore ok ${STAMP}"
echo "If API was running during restore, restart it. Then: python -m app.db.sync_check_buckets"
