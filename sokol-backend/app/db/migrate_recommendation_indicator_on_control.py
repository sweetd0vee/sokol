"""Переименовывает индикатор «ожидает» в «на контроле»."""

from app.db.migrations.patches import RECOMMENDATION_INDICATOR_ON_CONTROL
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_recommendation_indicator_on_control

migrate, main = bind_sql_patch(RECOMMENDATION_INDICATOR_ON_CONTROL)

if __name__ == "__main__":
    main()
