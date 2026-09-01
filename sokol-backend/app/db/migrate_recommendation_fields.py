"""Добавляет sequence_number, description и materiality_level в recommendations."""

from app.db.migrations.patches import RECOMMENDATION_FIELDS
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_recommendation_fields

migrate, main = bind_sql_patch(RECOMMENDATION_FIELDS)

if __name__ == "__main__":
    main()
