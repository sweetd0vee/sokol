"""Добавляет поле краткого названия в checks."""

from app.db.migrations.patches import CHECK_SHORT_NAME
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_check_short_name

migrate, main = bind_sql_patch(CHECK_SHORT_NAME)

if __name__ == "__main__":
    main()
