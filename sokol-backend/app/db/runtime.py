"""Shared helpers for CLI entrypoints, SQL patches, and operational table resets."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Sequence

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.db.session import engine

OPERATIONAL_TABLES_TRUNCATE_SQL = (
    "TRUNCATE TABLE recommendation_audit_objects, recommendations, checks "
    "RESTART IDENTITY CASCADE"
)


async def execute_sql_statements(statements: Sequence[str]) -> None:
    async with engine.begin() as conn:
        for statement in statements:
            await conn.execute(text(statement))


async def truncate_operational_tables(session: AsyncSession) -> None:
    await session.execute(text(OPERATIONAL_TABLES_TRUNCATE_SQL))
    await session.commit()


async def count_rows(session: AsyncSession, model: type[DeclarativeBase]) -> int:
    return int(await session.scalar(select(func.count()).select_from(model)) or 0)


async def table_is_nonempty(session: AsyncSession, model: type[DeclarativeBase]) -> bool:
    return bool(await count_rows(session, model))


async def run_seed_cli(
    message: str,
    seed_fn: Callable[..., Awaitable[int]],
    *args,
    **kwargs,
) -> None:
    from app.db.init_db import init_db

    await init_db()
    inserted = await seed_fn(*args, **kwargs)
    print(f"{message}: {inserted}")


def run_async_main(async_main: Callable[[], Awaitable[None]]) -> None:
    asyncio.run(async_main())
