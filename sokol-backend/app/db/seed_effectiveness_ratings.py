from app.db.catalogs.effectiveness import EFFECTIVENESS_RATINGS
from app.db.runtime import run_async_main, run_seed_cli
from app.db.seeds.effectiveness import seed_effectiveness_ratings

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_effectiveness_ratings

__all__ = ["EFFECTIVENESS_RATINGS", "seed_effectiveness_ratings"]


async def main() -> None:
    await run_seed_cli("Seeded effectiveness ratings", seed_effectiveness_ratings, EFFECTIVENESS_RATINGS)


if __name__ == "__main__":
    run_async_main(main)
