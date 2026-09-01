"""Add FK constraints from domain string fields to settings dictionaries."""

from app.db.migrations.dictionary_foreign_keys import migrate
from app.db.runtime import run_async_main

# python -m app.db.migrate_dictionary_foreign_keys


def main() -> None:
    run_async_main(migrate)


if __name__ == "__main__":
    main()
