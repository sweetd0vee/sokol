"""Row counts for analytics dashboards."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.services.analytics.sql_filters import apply_check_filters, apply_recommendation_filters
from app.services.analytics.sql_helpers import count_rows

async def count_checks(session: AsyncSession, *, filtered: bool = False, **filters: Any) -> int:
    return await count_rows(session, Check, apply_check_filters, filtered=filtered, **filters)


async def count_recommendations(session: AsyncSession, *, filtered: bool = False, **filters: Any) -> int:
    return await count_rows(
        session,
        Recommendation,
        apply_recommendation_filters,
        filtered=filtered,
        **filters,
    )
