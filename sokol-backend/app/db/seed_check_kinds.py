from app.db.catalogs.check_kinds import CHECK_KINDS
from app.db.runtime import run_async_main, run_seed_cli
from app.db.seeds.check_kinds import seed_check_kinds

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_check_kinds

__all__ = ["CHECK_KINDS", "seed_check_kinds"]


async def main() -> None:
    await run_seed_cli("Seeded check kinds", seed_check_kinds, CHECK_KINDS)


if __name__ == "__main__":
    run_async_main(main)
