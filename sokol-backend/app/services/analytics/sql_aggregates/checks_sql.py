"""SQL aggregates for the checks analytics dashboard."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.schemas.analytics import ChecksSummary, NamedCount, PeriodCount, PeriodGranularity
from app.services.analytics.constants import CHECK_TYPE_PLURAL_LABELS
from app.services.analytics.sql_filters import apply_check_filters, check_filter_conditions
from app.services.analytics.sql_helpers import (
    accumulate_period_totals,
    apply_period_grouped_query,
    check_status_count_columns,
    fetch_all,
    fetch_one,
    grouped_named_counts_sql,
    period_from_sql_row,
)

async def summarize_checks_sql(session: AsyncSession, **filters: Any) -> ChecksSummary:
    statement = apply_check_filters(
        select(*check_status_count_columns()).select_from(Check),
        **filters,
    )
    row = await fetch_one(session, statement)
    return ChecksSummary(
        total=int(row.total),
        not_started=int(row.not_started),
        in_progress=int(row.in_progress),
        completed=int(row.completed),
    )


def check_duration_days(order_date: date | None, dz_date: date | None) -> int | None:
    """Calendar days from the order to the report (ДЗ).

    A check is finished only when both dates are filled and the report is not
    earlier than the order. Program, АЗ, «Начало» and «Окончание» are not the
    duration: an open check has no known length yet.
    """
    if order_date is None or dz_date is None or dz_date < order_date:
        return None
    return (dz_date - order_date).days


def average_check_duration_days(spans: list[int]) -> int:
    if not spans:
        return 0
    return int(round(sum(spans) / len(spans)))


async def average_check_duration_days_sql(session: AsyncSession, **filters: Any) -> int:
    """Mean calendar days from the order to ДЗ. Checks without both dates are excluded."""
    statement = apply_check_filters(
        select(Check.order_document_date, Check.dz_document_date).select_from(Check),
        **filters,
    )
    spans: list[int] = []
    for row in await fetch_all(session, statement):
        days = check_duration_days(row.order_document_date, row.dz_document_date)
        if days is not None:
            spans.append(days)
    return average_check_duration_days(spans)



async def check_period_series_sql(
    session: AsyncSession,
    granularity: PeriodGranularity,
    **filters: Any,
) -> list[PeriodCount]:
    statement = apply_period_grouped_query(
        model=Check,
        date_column=Check.start_date,
        granularity=granularity,
        extra_columns=check_status_count_columns(),
        apply_filters=apply_check_filters,
        **filters,
    )
    buckets: list[PeriodCount] = []
    for row in await fetch_all(session, statement):
        period = period_from_sql_row(row, granularity)
        buckets.append(
            PeriodCount(
                key=period.key,
                label=period.label,
                sort_key=period.sort_key,
                total=int(row.total),
                not_started=int(row.not_started),
                in_progress=int(row.in_progress),
                completed=int(row.completed),
                cumulative=0,
            )
        )
    return accumulate_period_totals(buckets)


async def check_view_distribution_sql(session: AsyncSession, **filters: Any) -> list[NamedCount]:
    return await grouped_named_counts_sql(
        session,
        model=Check,
        column=Check.check_view,
        filters=check_filter_conditions(**filters),
    )


async def check_type_distribution_sql(session: AsyncSession, **filters: Any) -> list[NamedCount]:
    rows = await grouped_named_counts_sql(
        session,
        model=Check,
        column=Check.check_type,
        filters=check_filter_conditions(**filters),
    )
    return [
        NamedCount(name=CHECK_TYPE_PLURAL_LABELS.get(row.name, row.name), value=row.value)
        for row in rows
    ]
