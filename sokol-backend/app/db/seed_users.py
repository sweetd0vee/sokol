from app.db.catalogs.users import (
    ADMIN_ALIASES,
    ADMIN_DISPLAY_NAME,
    ADMIN_USERNAME,
    DEPARTMENT_HEAD_DISPLAY_NAME,
    DEPARTMENT_HEAD_USERNAME,
)
from app.db.runtime import run_async_main, run_seed_cli
from app.db.seeds.users import seed_users

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_users

__all__ = [
    "ADMIN_ALIASES",
    "ADMIN_DISPLAY_NAME",
    "ADMIN_USERNAME",
    "DEPARTMENT_HEAD_DISPLAY_NAME",
    "DEPARTMENT_HEAD_USERNAME",
    "seed_users",
]


async def main() -> None:
    await run_seed_cli("Seeded users", seed_users)


if __name__ == "__main__":
    run_async_main(main)
