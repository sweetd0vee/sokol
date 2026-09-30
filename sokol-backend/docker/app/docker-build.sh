#!/usr/bin/env bash
# Build API image from repository root.
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
docker build -t sber/sokol-be:master -f "$repo_root/sokol-backend/docker/app/Dockerfile" "$repo_root"
