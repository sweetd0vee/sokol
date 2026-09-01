"""Создаёт таблицу attachments."""

from app.db.migrations.patches import ATTACHMENTS
from app.db.migrations.sql import bind_sql_patch

# python -m app.db.migrate_attachments

migrate, main = bind_sql_patch(ATTACHMENTS)

if __name__ == "__main__":
    main()
