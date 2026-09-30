#!/usr/bin/env python3
"""Sleep until the next daily backup slot (default 00:05 Europe/Moscow = UTC+3)."""

from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timedelta, time as dt_time
from zoneinfo import ZoneInfo

DEFAULT_TZ = "Europe/Moscow"
DEFAULT_AT = "00:05"


def parse_hhmm(raw: str) -> tuple[int, int]:
    text = raw.strip()
    parts = text.split(":")
    if len(parts) != 2:
        raise ValueError(f"expected HH:MM, got {raw!r}")
    hour = int(parts[0])
    minute = int(parts[1])
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"invalid time {raw!r}")
    return hour, minute


def next_run_at(now: datetime, hour: int, minute: int) -> datetime:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    target = datetime.combine(now.date(), dt_time(hour, minute), tzinfo=now.tzinfo)
    if now <= target:
        return target
    return target + timedelta(days=1)


def seconds_until_next_run(now: datetime, hour: int, minute: int) -> int:
    delta = next_run_at(now, hour, minute) - now
    return max(0, int(delta.total_seconds()))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sleep", action="store_true")
    parser.add_argument("--seconds", action="store_true")
    args = parser.parse_args(argv)
    tz_name = os.environ.get("SOKOL_BACKUP_TZ", DEFAULT_TZ)
    hour, minute = parse_hhmm(os.environ.get("SOKOL_BACKUP_AT", DEFAULT_AT))
    now = datetime.now(ZoneInfo(tz_name))
    seconds = seconds_until_next_run(now, hour, minute)
    nxt = next_run_at(now, hour, minute)
    print(f"next backup at {nxt.isoformat()} ({seconds}s)", flush=True)
    if args.seconds:
        print(seconds)
        return 0
    if args.sleep:
        if seconds:
            time.sleep(seconds)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
