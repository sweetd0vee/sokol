"""Adds persistent auditor codes used in check serial numbers."""

from app.db.migrations.auditor_codes import migrate
from app.db.runtime import run_async_main

# python -m app.db.migrate_auditor_codes


def main() -> None:
    run_async_main(migrate)


if __name__ == "__main__":
    main()
