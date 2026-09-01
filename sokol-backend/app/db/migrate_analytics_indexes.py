"""Indexes for analytics filter/aggregate columns."""

from app.db.migrations.patches import ANALYTICS_INDEXES
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_analytics_indexes

migrate, main = bind_sql_patch(ANALYTICS_INDEXES)

if __name__ == "__main__":
    main()
