"""Canonicalizes recommendation audit objects against departments dictionary."""

from app.db.migrations.recommendation_audit_object_canonical import migrate
from app.db.runtime import run_async_main

# python -m app.db.migrate_recommendation_audit_object_canonical


def main() -> None:
    run_async_main(migrate)


if __name__ == "__main__":
    main()
