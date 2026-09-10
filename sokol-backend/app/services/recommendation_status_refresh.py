"""Persist date-driven recommendation statuses and run the daily refresh loop."""

from __future__ import annotations

import asyncio
import logging
import os

from sqlalchemy import select

from app.core.startup_validation import env_flag_enabled
from app.db.session import AsyncSessionLocal
from app.models.recommendations import Recommendation
from app.services.recommendation_status import (
    apply_computed_status_to_recommendation,
    seconds_until_next_moscow_run,
    today_moscow,
)

logger = logging.getLogger(__name__)


def status_scheduler_enabled() -> bool:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return False
    return env_flag_enabled(os.getenv("SOKOL_STATUS_SCHEDULER"), default=True)


async def refresh_recommendation_statuses() -> int:
    today = today_moscow()
    updated = 0
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Recommendation))
        for recommendation in result.scalars():
            if apply_computed_status_to_recommendation(recommendation, today=today):
                updated += 1
        if updated:
            await session.commit()
        else:
            await session.rollback()
    if updated:
        logger.info("Updated date-driven status on %s recommendation(s)", updated)
    else:
        logger.info("Recommendation statuses already match %s", today.isoformat())
    return updated


async def run_recommendation_status_scheduler() -> None:
    while True:
        try:
            await refresh_recommendation_statuses()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Recommendation status refresh failed")
        try:
            await asyncio.sleep(seconds_until_next_moscow_run())
        except asyncio.CancelledError:
            raise
