"""CLI: python -m app.db.migrations [--list|--bootstrap|--all|NAME]."""

from __future__ import annotations

import argparse
import sys

from app.db.migrations import ALL_MIGRATIONS, get_migration, run_all_migrations, run_bootstrap_migrations
from app.db.runtime import run_async_main


def _print_list() -> None:
    print("Available migrations:")
    for item in ALL_MIGRATIONS:
        tags: list[str] = []
        if item.in_bootstrap:
            tags.append("bootstrap")
        if item.rewrites_data:
            tags.append("rewrites-data")
        suffix = f" ({', '.join(tags)})" if tags else ""
        print(f"  {item.name}{suffix}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m app.db.migrations",
        description="Run idempotent schema/data patches until Alembic is adopted.",
    )
    parser.add_argument("name", nargs="?", help="Run a single named migration")
    parser.add_argument("--list", action="store_true", help="List available migrations")
    parser.add_argument("--bootstrap", action="store_true", help="Run the Docker bootstrap subset")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run every non-destructive migration in registry order",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    selected = sum(bool(flag) for flag in (args.list, args.bootstrap, args.all, args.name))
    if selected > 1:
        print("Specify exactly one of: NAME, --list, --bootstrap, --all", file=sys.stderr)
        return 2
    if args.list or selected == 0:
        _print_list()
        return 0
    if args.bootstrap:
        run_async_main(run_bootstrap_migrations)
        return 0
    if args.all:
        run_async_main(run_all_migrations)
        return 0

    try:
        migration = get_migration(args.name)
    except KeyError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if migration.rewrites_data:
        print(
            f"Warning: {migration.name} rewrites live recommendation data.",
            file=sys.stderr,
        )
    run_async_main(migration.migrate)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
