"""Добавляет поля информации о закрытии в recommendations."""

from app.db.migrations.patches import RECOMMENDATION_CLOSURE
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_recommendation_closure

migrate, main = bind_sql_patch(RECOMMENDATION_CLOSURE)

if __name__ == "__main__":
    main()
