"""Converts recommendation audit_object from text value to text array."""

from app.db.migrations.patches import RECOMMENDATION_AUDIT_OBJECT_ARRAY
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_recommendation_audit_object_array

migrate, main = bind_sql_patch(RECOMMENDATION_AUDIT_OBJECT_ARRAY)

if __name__ == "__main__":
    main()
