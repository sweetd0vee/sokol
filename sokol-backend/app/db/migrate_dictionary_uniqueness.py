"""Normalize dictionary labels, deduplicate rows, and add unique indexes."""

from app.db.migrations.dictionary_uniqueness import migrate
from app.db.runtime import run_async_main

# python -m app.db.migrate_dictionary_uniqueness


def main() -> None:
    run_async_main(migrate)


if __name__ == "__main__":
    main()
