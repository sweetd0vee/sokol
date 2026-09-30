#!/usr/bin/env bash
# Build UI image. Optional: VITE_API_URL=http://host:8800 ./docker-build.sh
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
frontend_root="$(cd "$script_dir/.." && pwd)"
api_url="${VITE_API_URL:-http://localhost:8800}"
docker build \
  -t sber/sokol-fe:master \
  -f "$frontend_root/docker/Dockerfile" \
  --build-arg "VITE_API_URL=${api_url}" \
  "$frontend_root"
