#!/usr/bin/env bash
# UI only (network sokol must already exist).
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"
docker compose up --build -d "$@"
