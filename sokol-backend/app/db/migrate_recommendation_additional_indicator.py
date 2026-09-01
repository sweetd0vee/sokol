"""Добавляет индикатор дополнительного статуса в recommendations."""

from app.db.migrations.patches import RECOMMENDATION_ADDITIONAL_INDICATOR
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_recommendation_additional_indicator

migrate, main = bind_sql_patch(RECOMMENDATION_ADDITIONAL_INDICATOR)

if __name__ == "__main__":
    main()
