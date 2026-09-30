#!/bin/bash
set -euo pipefail

BACKUP_ROOT="${SOKOL_BACKUP_DIR:-/backups}"
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-postgres}"
PGDATABASE="${POSTGRES_DB:-sokol_db}"
export SOKOL_MINIO_ENDPOINT="${SOKOL_MINIO_ENDPOINT:-minio:9000}"
export MINIO_ROOT_USER="${MINIO_ROOT_USER:-${SOKOL_MINIO_ACCESS_KEY:-sokol}}"
export MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-${SOKOL_MINIO_SECRET_KEY:?MINIO_ROOT_PASSWORD is required}}"
export SOKOL_MINIO_SECURE="${SOKOL_MINIO_SECURE:-0}"
KEEP_DAYS="${SOKOL_BACKUP_KEEP_DAYS:-14}"
KEEP_MIN="${SOKOL_BACKUP_KEEP_MIN:-3}"

mkdir -p "${BACKUP_ROOT}"
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -name '.partial-*' -mtime +1 -exec rm -rf {} +

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
TMP="${BACKUP_ROOT}/.partial-${STAMP}"
DEST="${BACKUP_ROOT}/${STAMP}"
rm -rf "${TMP}"
mkdir -p "${TMP}/minio"

cleanup() {
  rm -rf "${TMP}"
}
trap cleanup EXIT

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
pg_dump \
  -h "${PGHOST}" \
  -p "${PGPORT}" \
  -U "${PGUSER}" \
  -d "${PGDATABASE}" \
  -Fc \
  --no-owner \
  --no-acl \
  -f "${TMP}/postgres.dump"
pg_restore -l "${TMP}/postgres.dump" >/dev/null

OBJECT_COUNT="$(python3 /opt/sokol-backup/minio_sync.py dump "${TMP}/minio" | tr -d '[:space:]')"
OBJECT_COUNT="${OBJECT_COUNT:-0}"

DUMP_BYTES="$(wc -c < "${TMP}/postgres.dump" | tr -d ' ')"
DUMP_SHA="$(sha256sum "${TMP}/postgres.dump" | awk '{print $1}')"

cat > "${TMP}/MANIFEST.txt" <<EOF
created_at_utc=${STAMP}
postgres_host=${PGHOST}
postgres_db=${PGDATABASE}
postgres_dump_bytes=${DUMP_BYTES}
postgres_dump_sha256=${DUMP_SHA}
minio_endpoint=${SOKOL_MINIO_ENDPOINT}
minio_object_count=${OBJECT_COUNT}
keep_days=${KEEP_DAYS}
keep_min=${KEEP_MIN}
EOF

mv "${TMP}" "${DEST}"
trap - EXIT
printf '%s\n' "${STAMP}" > "${BACKUP_ROOT}/LAST_OK"

python3 /opt/sokol-backup/retention.py \
  --root "${BACKUP_ROOT}" \
  --keep-days "${KEEP_DAYS}" \
  --keep-min "${KEEP_MIN}"

echo "backup ok ${STAMP} dump=${DUMP_BYTES}B objects=${OBJECT_COUNT}"
