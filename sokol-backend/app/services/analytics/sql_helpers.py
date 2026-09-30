"""Shared SQL building blocks for analytics aggregates."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import ColumnElement, and_, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import Select

from app.models.checks import Check, CheckStatus
from app.models.recommendations import Recommendation
from app.schemas.analytics import ChecksSummary, NamedCount, PeriodGranularity
from app.services.analytics.constants import WITHOUT_CHECK
from app.services.analytics.period import PeriodBucket, get_period_bucket
from app.services.analytics.values import completion_share, named_counts


def count_if(condition: ColumnElement[bool], label: str):
    return func.count().filter(condition).label(label)


def check_status_count_columns():
    return (
        func.count().label("total"),
        count_if(Check.status == CheckStatus.NOT_STARTED, "not_started"),
        count_if(Check.status == CheckStatus.IN_PROGRESS, "in_progress"),
        count_if(Check.status == CheckStatus.COMPLETED, "completed"),
    )


def recommendation_status_count_columns():
    return (
        count_if(Recommendation.status == "completed", "completed"),
        count_if(Recommendation.status == "unresolved", "unresolved"),
        count_if(Recommendation.status == "on_control", "on_control"),
        count_if(Recommendation.status == "in_progress", "in_progress"),
    )


def recommendation_materiality_count_columns():
    return (
        count_if(Recommendation.materiality_level == "низкий", "low"),
        count_if(Recommendation.materiality_level == "средний", "medium"),
        count_if(Recommendation.materiality_level == "высокий", "high"),
    )


def recommendation_has_extensions() -> ColumnElement[bool]:
    """True, если есть хотя бы один перенос: JSON-строки, legacy-даты или комментарии.

    Пустой JSON ``[]`` не считается переносом. ``extension_2_reason`` — дата второго
    переноса (как в статусах и в графике «Перенос срока»).
    """
    has_json_rows = and_(
        Recommendation.deadline_extensions.isnot(None),
        func.json_array_length(Recommendation.deadline_extensions) > 0,
    )
    return or_(
        has_json_rows,
        Recommendation.extension_1_date.isnot(None),
        Recommendation.extension_1_comment.isnot(None),
        Recommendation.extension_2_reason.isnot(None),
        Recommendation.extension_2_comment.isnot(None),
    )


def period_group_columns(date_column: ColumnElement, granularity: PeriodGranularity):
    year_col = extract("year", date_column).label("bucket_year")
    if granularity == "year":
        return (year_col,)
    if granularity == "quarter":
        return (year_col, extract("quarter", date_column).label("bucket_quarter"))
    return (year_col, extract("month", date_column).label("bucket_month"))


def bucket_date_from_row(row: Any, granularity: PeriodGranularity) -> date:
    year = int(row.bucket_year)
    if granularity == "year":
        return date(year, 1, 1)
    if granularity == "quarter":
        quarter = int(row.bucket_quarter)
        return date(year, (quarter - 1) * 3 + 1, 1)
    return date(year, int(row.bucket_month), 1)


def period_from_sql_row(row: Any, granularity: PeriodGranularity) -> PeriodBucket:
    return get_period_bucket(bucket_date_from_row(row, granularity), granularity)


def accumulate_period_totals(
    buckets: list,
    *,
    extra: Sequence[tuple[str, str]] = (),
) -> list:
    buckets.sort(key=lambda item: item.sort_key)
    running = 0
    extra_running = [0] * len(extra)
    for item in buckets:
        running += item.total
        item.cumulative = running
        for index, (source, dest) in enumerate(extra):
            extra_running[index] += getattr(item, source)
            setattr(item, dest, extra_running[index])
    return buckets


@dataclass(frozen=True)
class CheckGroupIdentity:
    id: str
    key: str
    short_name: str
    name: str


def check_group_identity(row: Any) -> CheckGroupIdentity:
    serial = str(row.serial_number or "").strip() or WITHOUT_CHECK
    check_id = row.check_id
    return CheckGroupIdentity(
        id=str(check_id) if check_id is not None else serial,
        key=serial,
        short_name=str(row.short_name or "").strip(),
        name=str(row.check_name or "").strip() or serial,
    )


def recommendation_grouped_by_check(*extra_columns) -> Select:
    return (
        select(
            Recommendation.serial_number,
            Check.id.label("check_id"),
            Check.short_name,
            Check.check_name,
            *extra_columns,
        )
        .select_from(Recommendation)
        .outerjoin(Check, Check.id == Recommendation.check_id)
        .group_by(Recommendation.serial_number, Check.id, Check.short_name, Check.check_name)
        .order_by(Recommendation.serial_number.asc())
    )


async def fetch_all(session: AsyncSession, statement: Select) -> Sequence[Any]:
    return (await session.execute(statement)).all()


async def fetch_one(session: AsyncSession, statement: Select) -> Any:
    return (await session.execute(statement)).one()


async def count_rows(
    session: AsyncSession,
    model: type[DeclarativeBase],
    apply_filters: Callable[..., Select],
    *,
    filtered: bool = False,
    **filters: Any,
) -> int:
    statement = select(func.count()).select_from(model)
    if filtered:
        statement = apply_filters(statement, **filters)
    result = await session.execute(statement)
    return int(result.scalar_one())


async def grouped_named_counts_sql(
    session: AsyncSession,
    *,
    model,
    column,
    filters: list,
    positive_only: bool = False,
    limit: int | None = None,
) -> list[NamedCount]:
    statement = (
        select(column.label("name"), func.count().label("value"))
        .select_from(model)
        .where(*filters)
        .group_by(column)
        .order_by(func.count().desc(), column.asc())
    )
    if limit is not None:
        statement = statement.limit(limit)
    rows = await fetch_all(session, statement)
    counts = {str(row.name): int(row.value) for row in rows if row.name is not None}
    return named_counts(counts, positive_only=positive_only)


async def distinct_nonempty_values(session: AsyncSession, column) -> set[str]:
    rows = await session.execute(
        select(column).where(column.isnot(None), column != "").distinct()
    )
    return {str(row[0]).strip() for row in rows.all() if row[0] and str(row[0]).strip()}


async def column_dates(session: AsyncSession, column) -> list[date]:
    rows = await session.execute(select(column).where(column.isnot(None)))
    return [row[0] for row in rows.all()]


def completion_share_from_summary(summary: ChecksSummary) -> int:
    return completion_share(summary.total, summary.completed)


def apply_period_grouped_query(
    *,
    model,
    date_column,
    granularity: PeriodGranularity,
    extra_columns: Sequence,
    apply_filters: Callable[..., Select],
    **filters: Any,
) -> Select:
    group_cols = period_group_columns(date_column, granularity)
    statement = (
        select(*group_cols, *extra_columns)
        .select_from(model)
        .group_by(*group_cols)
        .order_by(*group_cols)
    )
    return apply_filters(statement, **filters)
