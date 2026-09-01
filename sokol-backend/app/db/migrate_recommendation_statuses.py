"""Обновляет enum статуса и доп. статуса рекомендаций."""

from app.db.migrations.patches import RECOMMENDATION_STATUSES
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_recommendation_statuses

migrate, main = bind_sql_patch(RECOMMENDATION_STATUSES)

if __name__ == "__main__":
    main()
