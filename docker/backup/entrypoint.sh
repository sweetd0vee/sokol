#!/bin/bash
set -euo pipefail

if [[ $# -gt 0 ]]; then
  exec "$@"
fi

while true; do
  python3 /opt/sokol-backup/schedule.py --sleep
  if /opt/sokol-backup/backup.sh; then
    :
  else
    echo "backup failed" >&2
  fi
done
