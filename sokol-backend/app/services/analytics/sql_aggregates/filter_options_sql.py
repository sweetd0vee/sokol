"""SQL collectors for analytics filter options and period anchors."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.catalogs.departments import DEPARTMENTS
from app.models.checks import Check
from app.models.departments import Department
from app.models.recommendations import Recommendation
from app.services.analytics.sql_helpers import column_dates, distinct_nonempty_values
from app.services.analytics.values import pad_anchor_dates

async def collect_filter_option_auditors_sql(session: AsyncSession) -> list[str]:
    values: set[str] = set()
    for column in (Check.check_leader, Recommendation.auditor):
        values |= await distinct_nonempty_values(session, column)
    return sorted(values, key=lambda value: value.casefold())


async def collect_filter_option_recommendation_auditors_sql(session: AsyncSession) -> list[str]:
    values = await distinct_nonempty_values(session, Recommendation.auditor)
    return sorted(values, key=lambda value: value.casefold())


async def collect_filter_option_departments_sql(session: AsyncSession) -> list[str]:
    rows = await session.execute(
        select(Department.name)
        .where(Department.name.isnot(None), Department.name != "")
        .order_by(Department.name.asc())
    )
    values = [str(row[0]).strip() for row in rows.all() if row[0] and str(row[0]).strip()]
    if values:
        return values
    return sorted(DEPARTMENTS, key=lambda value: value.casefold())


async def collect_check_anchor_dates_sql(session: AsyncSession) -> list[str]:
    return pad_anchor_dates(await column_dates(session, Check.start_date))


async def collect_recommendation_anchor_dates_sql(session: AsyncSession) -> list[str]:
    return pad_anchor_dates(await column_dates(session, Recommendation.deadline))


async def collect_combined_anchor_dates_sql(session: AsyncSession) -> list[str]:
    check_dates = await column_dates(session, Check.start_date)
    rec_dates = await column_dates(session, Recommendation.deadline)
    return pad_anchor_dates(check_dates + rec_dates)
