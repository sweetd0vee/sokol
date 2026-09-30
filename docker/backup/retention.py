#!/usr/bin/env python3
"""Prune dated Sokol backup snapshots. Directory names: YYYY-MM-DDTHHMMSSZ."""

from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SNAPSHOT_FMT = "%Y-%m-%dT%H%M%SZ"


def parse_snapshot_name(name: str) -> datetime | None:
    try:
        return datetime.strptime(name, SNAPSHOT_FMT).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def directories_to_prune(
    root: Path,
    *,
    keep_days: int,
    keep_min: int,
    now: datetime,
) -> list[Path]:
    dated: list[tuple[datetime, Path]] = []
    for path in root.iterdir():
        if not path.is_dir() or path.name.startswith("."):
            continue
        stamp = parse_snapshot_name(path.name)
        if stamp is None:
            continue
        dated.append((stamp, path))
    dated.sort(key=lambda item: item[0])
    if not dated:
        return []

    keep_days = max(1, keep_days)
    keep_min = max(1, keep_min)
    newest = {path.name for _, path in dated[-keep_min:]}
    cutoff = now - timedelta(days=keep_days)
    doomed: list[Path] = []
    for stamp, path in dated:
        if path.name in newest:
            continue
        if stamp < cutoff:
            doomed.append(path)
    return doomed


def prune(
    root: Path,
    *,
    keep_days: int,
    keep_min: int,
    now: datetime | None = None,
    apply: bool = True,
) -> list[str]:
    now = now or datetime.now(timezone.utc)
    removed: list[str] = []
    for path in directories_to_prune(
        root, keep_days=keep_days, keep_min=keep_min, now=now
    ):
        removed.append(path.name)
        if apply:
            shutil.rmtree(path)
    return removed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prune Sokol backup snapshots")
    parser.add_argument("--root", required=True)
    parser.add_argument("--keep-days", type=int, default=14)
    parser.add_argument("--keep-min", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    root = Path(args.root)
    if not root.is_dir():
        print(f"backup root is not a directory: {root}", file=sys.stderr)
        return 1
    removed = prune(
        root,
        keep_days=args.keep_days,
        keep_min=args.keep_min,
        apply=not args.dry_run,
    )
    for name in removed:
        prefix = "would remove" if args.dry_run else "removed"
        print(f"{prefix} {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
