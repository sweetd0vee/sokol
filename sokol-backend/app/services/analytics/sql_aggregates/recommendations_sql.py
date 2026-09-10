"""SQL aggregates for recommendations and monitoring dashboards."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.schemas.analytics import (
    DeadlineExtensionByCheckRow,
    MaterialityMatrixRow,
    NamedCount,
    PeriodGranularity,
    RecommendationMaterialityCounts,
    RecommendationObjectCount,
    RecommendationPeriodCount,
    RecommendationsSummary,
    RecommendationsSummaryByAdditional,
    RecommendationsSummaryByMateriality,
    RecommendationsSummaryByStatus,
    StatusMatrixRow,
)
from app.services.analytics.constants import (
    CHECK_LINKS_LIMIT,
    DEFAULT_MATERIALITY,
    INDICATOR_COLORS,
    INDICATOR_KEY_ALIASES,
    INDICATOR_LABELS,
    MATERIALITY_LEVELS,
    UNSPECIFIED,
    WITHOUT_CHECK,
    WITHOUT_OBJECT,
)
from app.services.analytics.departments import parse_audit_object_parts
from app.services.analytics.sql_filters import apply_recommendation_filters, recommendation_filter_conditions
from app.services.analytics.sql_helpers import (
    accumulate_period_totals,
    apply_period_grouped_query,
    check_group_identity,
    count_if,
    fetch_all,
    fetch_one,
    grouped_named_counts_sql,
    period_from_sql_row,
    recommendation_grouped_by_check,
    recommendation_has_extensions,
    recommendation_materiality_count_columns,
    recommendation_status_count_columns,
)
from app.services.analytics.values import named_counts

async def summarize_recommendations_sql(session: AsyncSession, **filters: Any) -> RecommendationsSummary:
    statement = apply_recommendation_filters(
        select(
            func.count().label("total"),
            *recommendation_status_count_columns(),
            *recommendation_materiality_count_columns(),
            count_if(Recommendation.additional_status == "on_time", "on_time"),
            count_if(Recommendation.additional_status == "deadline_violated", "deadline_violated"),
            count_if(Recommendation.additional_status == "on_control", "add_on_control"),
            count_if(Recommendation.additional_status == "in_progress", "add_in_progress"),
            count_if(recommendation_has_extensions(), "with_extensions"),
            count_if(Recommendation.actual_completion_date.isnot(None), "with_completion_date"),
        ).select_from(Recommendation),
        **filters,
    )
    row = await fetch_one(session, statement)
    total = int(row.total)
    completed = int(row.completed)
    deadline_violated = int(row.deadline_violated)
    return RecommendationsSummary(
        total=total,
        by_status=RecommendationsSummaryByStatus(
            completed=completed,
            unresolved=int(row.unresolved),
            on_control=int(row.on_control),
            in_progress=int(row.in_progress),
        ),
        by_materiality=RecommendationsSummaryByMateriality(
            низкий=int(row.low),
            средний=int(row.medium),
            высокий=int(row.high),
        ),
        by_additional=RecommendationsSummaryByAdditional(
            on_time=int(row.on_time),
            deadline_violated=deadline_violated,
            on_control=int(row.add_on_control),
            in_progress=int(row.add_in_progress),
        ),
        with_extensions=int(row.with_extensions),
        with_completion_date=int(row.with_completion_date),
        completion_rate=round((completed / total) * 100) if total else 0,
        violation_rate=round((deadline_violated / total) * 100) if total else 0,
    )


async def recommendation_period_series_sql(
    session: AsyncSession,
    granularity: PeriodGranularity,
    **filters: Any,
) -> list[RecommendationPeriodCount]:
    statement = apply_period_grouped_query(
        model=Recommendation,
        date_column=Recommendation.deadline,
        granularity=granularity,
        extra_columns=(
            func.count().label("total"),
            *recommendation_status_count_columns(),
            *recommendation_materiality_count_columns(),
        ),
        apply_filters=apply_recommendation_filters,
        **filters,
    )
    buckets: list[RecommendationPeriodCount] = []
    for row in await fetch_all(session, statement):
        period = period_from_sql_row(row, granularity)
        buckets.append(
            RecommendationPeriodCount(
                key=period.key,
                label=period.label,
                sort_key=period.sort_key,
                total=int(row.total),
                completed=int(row.completed),
                unresolved=int(row.unresolved),
                on_control=int(row.on_control),
                in_progress=int(row.in_progress),
                low=int(row.low),
                medium=int(row.medium),
                high=int(row.high),
                cumulative=0,
                cumulative_completed=0,
            )
        )
    return accumulate_period_totals(buckets, extra=(("completed", "cumulative_completed"),))


async def recommendation_indicator_distribution_sql(
    session: AsyncSession,
    **filters: Any,
) -> list[NamedCount]:
    rows = await grouped_named_counts_sql(
        session,
        model=Recommendation,
        column=Recommendation.indicator,
        filters=recommendation_filter_conditions(**filters),
    )
    counts = {key: 0 for key in INDICATOR_LABELS}
    for row in rows:
        raw = (row.name or "не указан").strip().casefold()
        key = INDICATOR_KEY_ALIASES.get(raw, raw)
        if key == "не указан":
            continue
        counts[key] = counts.get(key, 0) + int(row.value)
    return [
        NamedCount(
            name=INDICATOR_LABELS.get(key, key),
            value=value,
            color=INDICATOR_COLORS.get(key),
        )
        for key, value in counts.items()
    ]


def _normalize_materiality(value: object) -> str:
    materiality_level = str(value or "").strip().casefold() or DEFAULT_MATERIALITY
    if materiality_level not in MATERIALITY_LEVELS:
        return DEFAULT_MATERIALITY
    return materiality_level


async def recommendation_object_distribution_sql(
    session: AsyncSession,
    **filters: Any,
) -> list[RecommendationObjectCount]:
    statement = select(Recommendation.audit_object, Recommendation.materiality_level).where(
        *recommendation_filter_conditions(**filters),
    )
    totals: dict[str, int] = defaultdict(int)
    materiality_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in await fetch_all(session, statement):
        parts = parse_audit_object_parts(row.audit_object)
        departments = parts if parts else [WITHOUT_OBJECT]
        materiality_level = _normalize_materiality(row.materiality_level)
        for department in departments:
            totals[department] += 1
            materiality_counts[department][materiality_level] += 1
    return [
        RecommendationObjectCount(
            name=name,
            value=value,
            materiality=RecommendationMaterialityCounts(
                низкий=materiality_counts[name].get("низкий", 0),
                средний=materiality_counts[name].get("средний", 0),
                высокий=materiality_counts[name].get("высокий", 0),
            ),
        )
        for name, value in sorted(totals.items(), key=lambda item: (-item[1], item[0]))
    ]


async def recommendation_materiality_matrix_sql(
    session: AsyncSession, **filters: Any
) -> list[MaterialityMatrixRow]:
    statement = apply_recommendation_filters(
        recommendation_grouped_by_check(
            *recommendation_materiality_count_columns(),
            func.count().label("total"),
        ),
        **filters,
    )
    result: list[MaterialityMatrixRow] = []
    for row in await fetch_all(session, statement):
        identity = check_group_identity(row)
        result.append(
            MaterialityMatrixRow(
                id=identity.id,
                key=identity.key,
                short_name=identity.short_name,
                name=identity.name,
                counts=RecommendationMaterialityCounts(
                    низкий=int(row.low or 0),
                    средний=int(row.medium or 0),
                    высокий=int(row.high or 0),
                ),
                total=int(row.total or 0),
            )
        )
    return result


async def recommendation_status_matrix_sql(
    session: AsyncSession, **filters: Any
) -> list[StatusMatrixRow]:
    statement = apply_recommendation_filters(
        recommendation_grouped_by_check(
            *recommendation_status_count_columns(),
            func.count().label("total"),
        ),
        **filters,
    )
    result: list[StatusMatrixRow] = []
    for row in await fetch_all(session, statement):
        identity = check_group_identity(row)
        result.append(
            StatusMatrixRow(
                id=identity.id,
                key=identity.key,
                short_name=identity.short_name,
                name=identity.name,
                counts=RecommendationsSummaryByStatus(
                    completed=int(row.completed or 0),
                    unresolved=int(row.unresolved or 0),
                    in_progress=int(row.in_progress or 0),
                    on_control=int(row.on_control or 0),
                ),
                total=int(row.total or 0),
            )
        )
    return result


def _count_recommendation_deadline_extensions(
    *,
    deadline_extensions: Any,
    extension_1_date: date | None,
    extension_1_comment: str | None,
    extension_2_reason: str | None,
    extension_2_comment: str | None,
) -> int:
    if isinstance(deadline_extensions, list) and deadline_extensions:
        count = 0
        for item in deadline_extensions:
            if not isinstance(item, dict):
                continue
            item_date = str(item.get("date") or "").strip()
            item_comment = str(item.get("comment") or "").strip()
            if item_date or item_comment:
                count += 1
        return count

    count = 0
    if extension_1_date is not None or str(extension_1_comment or "").strip():
        count += 1
    if str(extension_2_reason or "").strip() or str(extension_2_comment or "").strip():
        count += 1
    return count


async def recommendation_deadline_extensions_by_check_sql(
    session: AsyncSession, **filters: Any
) -> list[DeadlineExtensionByCheckRow]:
    statement = apply_recommendation_filters(
        select(
            Recommendation.serial_number,
            Check.id.label("check_id"),
            Check.short_name,
            Check.check_name,
            Recommendation.deadline_extensions,
            Recommendation.extension_1_date,
            Recommendation.extension_1_comment,
            Recommendation.extension_2_reason,
            Recommendation.extension_2_comment,
        )
        .select_from(Recommendation)
        .outerjoin(Check, Check.id == Recommendation.check_id),
        **filters,
    )

    totals: dict[str, dict[str, Any]] = {}
    for row in await fetch_all(session, statement):
        extension_count = _count_recommendation_deadline_extensions(
            deadline_extensions=row.deadline_extensions,
            extension_1_date=row.extension_1_date,
            extension_1_comment=row.extension_1_comment,
            extension_2_reason=row.extension_2_reason,
            extension_2_comment=row.extension_2_comment,
        )
        if extension_count <= 0:
            continue

        identity = check_group_identity(row)
        existing = totals.get(identity.id)
        if existing is None:
            totals[identity.id] = {
                "id": identity.id,
                "key": identity.key,
                "short_name": identity.short_name,
                "name": identity.name,
                "value": extension_count,
            }
        else:
            existing["value"] += extension_count

    return [
        DeadlineExtensionByCheckRow(
            id=item["id"],
            key=item["key"],
            short_name=item["short_name"],
            name=item["name"],
            value=int(item["value"]),
        )
        for item in sorted(totals.values(), key=lambda entry: (-int(entry["value"]), str(entry["key"])))
    ]


async def recommendation_completed_during_audit_by_check_sql(
    session: AsyncSession, **filters: Any
) -> list[DeadlineExtensionByCheckRow]:
    statement = apply_recommendation_filters(
        recommendation_grouped_by_check(
            count_if(Recommendation.indicator == "исполнено в ходе аудита", "value"),
        ),
        **filters,
    )
    result: list[DeadlineExtensionByCheckRow] = []
    for row in await fetch_all(session, statement):
        value = int(row.value or 0)
        if value <= 0:
            continue
        identity = check_group_identity(row)
        result.append(
            DeadlineExtensionByCheckRow(
                id=identity.id,
                key=identity.key,
                short_name=identity.short_name,
                name=identity.name,
                value=value,
            )
        )
    return sorted(result, key=lambda item: (-item.value, item.key))


def recommendation_view_distribution_from_rows(rows: Any) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        name = str(row.name or "").strip() or UNSPECIFIED
        counts[name] += int(row.value or 0)
    return named_counts(counts)


async def recommendation_view_distribution_sql(session: AsyncSession, **filters: Any) -> list[NamedCount]:
    statement = apply_recommendation_filters(
        select(Check.check_view.label("name"), func.count().label("value"))
        .select_from(Recommendation)
        .join(Check, Check.id == Recommendation.check_id)
        .group_by(Check.check_view)
        .order_by(func.count().desc(), Check.check_view.asc()),
        **filters,
    )
    return recommendation_view_distribution_from_rows(await fetch_all(session, statement))


async def recommendation_check_links_sql(session: AsyncSession, **filters: Any) -> list[NamedCount]:
    rows = await grouped_named_counts_sql(
        session,
        model=Recommendation,
        column=Recommendation.serial_number,
        filters=recommendation_filter_conditions(**filters),
        limit=CHECK_LINKS_LIMIT,
    )
    return [
        NamedCount(
            name=(row.name.strip() if row.name and row.name.strip() else WITHOUT_CHECK),
            value=row.value,
        )
        for row in rows
    ]
