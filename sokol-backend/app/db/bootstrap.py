"""Docker and presentation-demo bootstrap orchestration."""

from __future__ import annotations

import os

from sqlalchemy import func, select

from app.core.config import settings
from app.core.startup_validation import (
    assert_demo_data_safe_for_env,
    assert_seed_replace_safe_for_env,
    env_flag_enabled,
)
from app.db.import_seed_data import import_seed_data
from app.db.init_db import init_db
from app.db.migrations import run_bootstrap_migrations
from app.db.presentation_demo_data import generate_presentation_dataset
from app.db.seeds import seed_reference_dictionaries
from app.db.session import AsyncSessionLocal
from app.db.sync_check_buckets import sync_check_buckets
from app.db.sync_dictionaries import sync_auditors, sync_departments, sync_users
from app.models.checks import Check
from app.utils.paths import get_repo_data_dir


async def sync_canonical_dictionaries() -> tuple[tuple[int, int], tuple[int, int], tuple[int, int]]:
    auditors = await sync_auditors()
    departments = await sync_departments()
    users = await sync_users()
    return auditors, departments, users


async def run_docker_bootstrap() -> None:
    await init_db()
    await run_bootstrap_migrations()
    await seed_reference_dictionaries()

    auditors, departments, users = await sync_canonical_dictionaries()
    print(
        f"Synced dictionaries: auditors +{auditors[0]}/-{auditors[1]}, "
        f"departments +{departments[0]}/-{departments[1]}, "
        f"users +{users[0]}/-{users[1]}"
    )
    await sync_check_buckets()

    load_demo = env_flag_enabled(os.getenv("SOKOL_LOAD_DEMO_DATA"), default=True)
    force_replace = env_flag_enabled(os.getenv("SOKOL_SEED_REPLACE"), default=False)
    assert_demo_data_safe_for_env(env=settings.sokol_env, load_demo=load_demo)
    assert_seed_replace_safe_for_env(env=settings.sokol_env, replace=force_replace)
    if not load_demo:
        print("SOKOL_LOAD_DEMO_DATA disabled — skip demo import.")
        return

    async with AsyncSessionLocal() as session:
        count = int(await session.scalar(select(func.count()).select_from(Check)) or 0)
    if force_replace or count == 0:
        print("Loading demo data from Excel...")
        await import_seed_data(replace=force_replace)
    else:
        print(f"Checks already present ({count}) — skip demo import.")


async def bootstrap_presentation_demo(*, replace_data: bool = True) -> None:
    assert_seed_replace_safe_for_env(env=settings.sokol_env, replace=replace_data)
    await init_db()
    await seed_reference_dictionaries()

    auditors, departments, users = await sync_canonical_dictionaries()

    data_dir = get_repo_data_dir()
    generate_presentation_dataset(output_dir=data_dir)
    await import_seed_data(
        replace=replace_data,
        checks_path=data_dir / "checks.xlsx",
        recommendations_path=data_dir / "recommendations.xlsx",
    )

    print("Presentation demo bootstrap completed.")
    print(f"Auditors: +{auditors[0]} / -{auditors[1]}")
    print(f"Departments: +{departments[0]} / -{departments[1]}")
    print(f"Users: +{users[0]} / -{users[1]}")


async def main() -> None:
    await bootstrap_presentation_demo(replace_data=True)
