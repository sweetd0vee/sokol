"""Persist date-driven recommendation and check statuses and run the daily refresh loop."""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Callable

from sqlalchemy import select

from app.core.startup_validation import env_flag_enabled
from app.db.session import AsyncSessionLocal
from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.services.check_status import apply_computed_status_to_check
from app.services.recommendation_status import (
    apply_computed_status_to_recommendation,
    seconds_until_next_moscow_run,
    today_moscow,
)
from app.core.logging import log_caught_exception

logger = logging.getLogger(__name__)


def status_scheduler_enabled() -> bool:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return False
    return env_flag_enabled(os.getenv("SOKOL_STATUS_SCHEDULER"), default=True)


async def _refresh_statuses(
    model: type,
    apply_status: Callable[..., bool],
    *,
    updated_log: str,
    unchanged_log: str,
) -> int:
    today = today_moscow()
    updated = 0
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(model))
        for entity in result.scalars():
            if apply_status(entity, today=today):
                updated += 1
        if updated:
            await session.commit()
        else:
            await session.rollback()
    if updated:
        logger.info(updated_log, updated)
    else:
        logger.info(unchanged_log, today.isoformat())
    return updated


async def refresh_recommendation_statuses() -> int:
    return await _refresh_statuses(
        Recommendation,
        apply_computed_status_to_recommendation,
        updated_log="Updated date-driven status on %s recommendation(s)",
        unchanged_log="Recommendation statuses already match %s",
    )


async def refresh_check_statuses() -> int:
    return await _refresh_statuses(
        Check,
        apply_computed_status_to_check,
        updated_log="Updated date-driven status on %s check(s)",
        unchanged_log="Check statuses already match %s",
    )


async def run_status_scheduler() -> None:
    while True:
        for refresh, label in (
            (refresh_recommendation_statuses, "Recommendation"),
            (refresh_check_statuses, "Check"),
        ):
            try:
                await refresh()
            except asyncio.CancelledError:
                raise
            except Exception:
                log_caught_exception(logger, "%s status refresh failed", label)
        try:
            await asyncio.sleep(seconds_until_next_moscow_run())
        except asyncio.CancelledError:
            raise


async def run_recommendation_status_scheduler() -> None:
    await run_status_scheduler()
