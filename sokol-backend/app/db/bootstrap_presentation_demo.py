"""Синхронизация справочников и загрузка презентационного демо-датасета."""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.roles import Role
from app.core.security import hash_password
from app.crud.users_crud import ensure_user, get_user_by_username
from app.db.auditor_names import AUDITORS
from app.db.import_seed_data import import_seed_data
from app.db.init_db import init_db
from app.db.presentation_demo_data import generate_presentation_dataset
from app.db.seed_audit_types import AUDIT_TYPES, seed_audit_types
from app.db.seed_check_kinds import CHECK_KINDS, seed_check_kinds
from app.db.seed_effectiveness_ratings import EFFECTIVENESS_RATINGS, seed_effectiveness_ratings
from app.db.session import AsyncSessionLocal
from app.models.auditors import Auditor
from app.models.departments import Department
from app.models.users import User
from app.db.department_names import DEPARTMENTS
from app.utils.dictionary_text import normalize_dictionary_label
from app.utils.paths import get_repo_data_dir

ADMIN_USERNAME = "Админ А.А."
ADMIN_DISPLAY_NAME = "Администратор"
ADMIN_ALIASES = ("admin",)


async def sync_auditors() -> tuple[int, int]:
    canonical = {normalize_dictionary_label(name): name for name in AUDITORS}
    added = 0
    removed = 0
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(Auditor))).scalars().all()
        for row in rows:
            if normalize_dictionary_label(row.full_name) not in canonical:
                await session.delete(row)
                removed += 1
        await session.commit()

        existing = {
            normalize_dictionary_label(row.full_name)
            for row in (await session.execute(select(Auditor))).scalars().all()
        }
        for name in AUDITORS:
            if normalize_dictionary_label(name) in existing:
                continue
            session.add(Auditor(full_name=name))
            added += 1
        await session.commit()
    return added, removed


async def sync_departments() -> tuple[int, int]:
    canonical = {normalize_dictionary_label(name): name for name in DEPARTMENTS}
    added = 0
    removed = 0
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(Department))).scalars().all()
        for row in rows:
            if normalize_dictionary_label(row.name) not in canonical:
                await session.delete(row)
                removed += 1
        await session.commit()

        existing = {
            normalize_dictionary_label(row.name)
            for row in (await session.execute(select(Department))).scalars().all()
        }
        for name in DEPARTMENTS:
            if normalize_dictionary_label(name) in existing:
                continue
            session.add(Department(name=name))
            added += 1
        await session.commit()
    return added, removed


async def sync_users() -> tuple[int, int]:
    added = 0
    removed = 0
    canonical_auditors = {normalize_dictionary_label(name) for name in AUDITORS}
    async with AsyncSessionLocal() as session:
        if await get_user_by_username(session, ADMIN_USERNAME) is None:
            await ensure_user(
                session,
                username=ADMIN_USERNAME,
                password=settings.sokol_admin_password,
                role=Role.ADMIN,
                display_name=ADMIN_DISPLAY_NAME,
                aliases=ADMIN_ALIASES,
            )
            added += 1

        users = (await session.execute(select(User))).scalars().all()
        for user in users:
            if user.role == Role.ADMIN.value:
                continue
            if normalize_dictionary_label(user.username) not in canonical_auditors:
                await session.delete(user)
                removed += 1
        await session.commit()

        for name in AUDITORS:
            if await get_user_by_username(session, name) is None:
                session.add(
                    User(
                        username=name,
                        password_hash=hash_password(settings.sokol_default_user_password),
                        role=Role.AUDITOR.value,
                        display_name=name,
                        is_active=True,
                    )
                )
                added += 1
        await session.commit()
    return added, removed


async def bootstrap_presentation_demo(*, replace_data: bool = True) -> None:
    await init_db()
    await seed_audit_types(AUDIT_TYPES)
    await seed_check_kinds(CHECK_KINDS)
    await seed_effectiveness_ratings(EFFECTIVENESS_RATINGS)

    auditors_added, auditors_removed = await sync_auditors()
    departments_added, departments_removed = await sync_departments()
    users_added, users_removed = await sync_users()

    data_dir = get_repo_data_dir()
    generate_presentation_dataset(output_dir=data_dir)
    await import_seed_data(
        replace=replace_data,
        checks_path=data_dir / "checks.xlsx",
        recommendations_path=data_dir / "recommendations.xlsx",
    )

    print("Presentation demo bootstrap completed.")
    print(f"Auditors: +{auditors_added} / -{auditors_removed}")
    print(f"Departments: +{departments_added} / -{departments_removed}")
    print(f"Users: +{users_added} / -{users_removed}")


async def main() -> None:
    await bootstrap_presentation_demo(replace_data=True)


if __name__ == "__main__":
    asyncio.run(main())
