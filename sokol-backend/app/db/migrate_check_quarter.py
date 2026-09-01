"""Adds the required calendar quarter used in check serial numbers."""

from app.db.migrations.patches import CHECK_QUARTER
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_check_quarter

migrate, main = bind_sql_patch(CHECK_QUARTER)

if __name__ == "__main__":
    main()
