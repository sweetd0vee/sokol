"""Apply database schema via Alembic (see ``app.db.alembic_runner``).

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db \
# python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
"""

from app.db.alembic_runner import ensure_schema


async def init_db() -> None:
    await ensure_schema()
