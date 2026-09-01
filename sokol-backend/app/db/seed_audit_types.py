from app.db.catalogs.audit_types import AUDIT_TYPES
from app.db.runtime import run_async_main, run_seed_cli
from app.db.seeds.audit_types import seed_audit_types

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_audit_types

__all__ = ["AUDIT_TYPES", "seed_audit_types"]


async def main() -> None:
    await run_seed_cli("Seeded audit types", seed_audit_types, AUDIT_TYPES)


if __name__ == "__main__":
    run_async_main(main)
