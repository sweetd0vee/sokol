from app.db.catalogs.auditors import AUDITORS
from app.db.runtime import run_async_main, run_seed_cli
from app.db.seeds.auditors import seed_auditors

__all__ = ["seed_auditors"]

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_auditors


async def main() -> None:
    await run_seed_cli("Seeded auditors", seed_auditors, AUDITORS)


if __name__ == "__main__":
    run_async_main(main)
