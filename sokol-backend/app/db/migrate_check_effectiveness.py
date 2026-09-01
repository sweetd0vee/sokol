"""Добавляет поля оценок эффективности в checks."""

from app.db.migrations.patches import CHECK_EFFECTIVENESS
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_check_effectiveness

migrate, main = bind_sql_patch(CHECK_EFFECTIVENESS)

if __name__ == "__main__":
    main()
