#!/usr/bin/env bash
# Backend-only stack (db + minio + api + backup).
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"
docker compose up --build -d "$@"
