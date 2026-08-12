import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.roles import Role
from app.crud.users_crud import ensure_user
from app.db.auditor_names import AUDITORS
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.auditors import Auditor

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_users

ADMIN_USERNAME = "Админ А.А."
ADMIN_DISPLAY_NAME = "Администратор"
ADMIN_ALIASES = ("admin",)


async def seed_users(*, only_if_empty: bool = False) -> int:
    inserted = 0
    async with AsyncSessionLocal() as session:
        if only_if_empty:
            from app.crud.users_crud import list_users

            if await list_users(session):
                return 0

        if await ensure_user(
            session,
            username=ADMIN_USERNAME,
            password=settings.sokol_admin_password,
            role=Role.ADMIN,
            display_name=ADMIN_DISPLAY_NAME,
            aliases=ADMIN_ALIASES,
        ):
            inserted += 1

        result = await session.execute(select(Auditor).order_by(Auditor.full_name.asc()))
        auditors = [row.full_name for row in result.scalars()]
        if not auditors:
            auditors = list(AUDITORS)

        for full_name in auditors:
            if await ensure_user(
                session,
                username=full_name,
                password=settings.sokol_default_user_password,
                role=Role.AUDITOR,
                display_name=full_name,
            ):
                inserted += 1

    return inserted


async def main() -> None:
    await init_db()
    inserted = await seed_users()
    print(f"Seeded users: {inserted}")


if __name__ == "__main__":
    asyncio.run(main())
