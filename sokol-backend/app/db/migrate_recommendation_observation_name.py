"""Добавляет название наблюдения в recommendations."""

from app.db.migrations.patches import RECOMMENDATION_OBSERVATION_NAME
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_recommendation_observation_name

migrate, main = bind_sql_patch(RECOMMENDATION_OBSERVATION_NAME)

if __name__ == "__main__":
    main()
