"""Убирает значение «не указан» у materiality_level и меняет DEFAULT на «средний»."""

from app.db.migrations.patches import MATERIALITY_REQUIRED
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_materiality_required

migrate, main = bind_sql_patch(MATERIALITY_REQUIRED)

if __name__ == "__main__":
    main()
