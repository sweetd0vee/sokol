from app.db.session import engine
from app.models import Base

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db \
# python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"

async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
