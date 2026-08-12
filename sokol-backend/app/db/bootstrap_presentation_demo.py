"""Синхронизация справочников и загрузка презентационного демо-датасета."""

from __future__ import annotations

import asyncio

from app.db.import_seed_data import import_seed_data
from app.db.init_db import init_db
from app.db.presentation_demo_data import generate_presentation_dataset
from app.db.seed_audit_types import AUDIT_TYPES, seed_audit_types
from app.db.seed_check_kinds import CHECK_KINDS, seed_check_kinds
from app.db.seed_effectiveness_ratings import EFFECTIVENESS_RATINGS, seed_effectiveness_ratings
from app.db.sync_dictionaries import sync_auditors, sync_departments, sync_users
from app.utils.paths import get_repo_data_dir


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
