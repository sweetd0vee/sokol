from app.db.catalogs.departments import DEPARTMENTS
from app.db.runtime import run_async_main, run_seed_cli
from app.db.seeds.departments import seed_departments

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_departments


async def main() -> None:
    await run_seed_cli("Seeded departments", seed_departments, DEPARTMENTS)


if __name__ == "__main__":
    run_async_main(main)
