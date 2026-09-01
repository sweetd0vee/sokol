"""Database package: session, schema init, catalogs, seeds, migrations, bootstrap.

Public CLI entrypoints stay at this package root so existing commands keep working:

- ``python -m app.db.seed_*``
- ``python -m app.db.migrate_*``
- ``python -m app.db.import_seed_data``
"""

from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal, engine, get_db_session

__all__ = ["AsyncSessionLocal", "engine", "get_db_session", "init_db"]
