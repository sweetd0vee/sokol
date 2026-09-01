"""Добавляет JSON-списки переносов срока и снятий с контроля."""

from app.db.migrations.patches import RECOMMENDATION_CLOSURE_LISTS
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_recommendation_closure_lists

migrate, main = bind_sql_patch(RECOMMENDATION_CLOSURE_LISTS)

if __name__ == "__main__":
    main()
