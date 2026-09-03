"""SQL-side aggregates for analytics dashboards."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.models.departments import Department
from app.models.recommendations import Recommendation
from app.schemas.analytics import (
    ChecksSummary,
    DeadlineExtensionByCheckRow,
    DocumentReadinessRow,
    DvaAuditorLoadRow,
    DvaAuditorMatrix,
    DvaAuditorMatrixCell,
    DvaAuditorMatrixRow,
    DvaAuditorDocumentRow,
    DvaAuditorExecutionRow,
    DvaAuditorMaterialityRow,
    DvaAuditorTimelinessRow,
    DvaPortfolioPoint,
    MaterialityMatrixRow,
    NamedCount,
    PeriodBucketSchema,
    PeriodCount,
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
    CHECK_TYPE_PLURAL_LABELS,
    DEFAULT_MATERIALITY,
    INDICATOR_COLORS,
    INDICATOR_KEY_ALIASES,
    INDICATOR_LABELS,
    MATERIALITY_LEVELS,
    UNSPECIFIED,
    WITHOUT_AUDITOR,
    WITHOUT_CHECK,
    WITHOUT_LEADER,
    WITHOUT_OBJECT,
)
from app.services.analytics.departments import department_map_from_pairs, parse_audit_object_parts
from app.services.analytics.sql_filters import (
    apply_check_filters,
    apply_recommendation_filters,
    check_filter_conditions,
    recommendation_filter_conditions,
)
from app.services.analytics.sql_helpers import (
    accumulate_period_totals,
    apply_period_grouped_query,
    check_group_identity,
    check_status_count_columns,
    column_dates,
    completion_share_from_summary,
    count_if,
    count_rows,
    distinct_nonempty_values,
    fetch_all,
    fetch_one,
    grouped_named_counts_sql,
    period_from_sql_row,
    period_group_columns,
    recommendation_grouped_by_check,
    recommendation_has_extensions,
    recommendation_materiality_count_columns,
    recommendation_status_count_columns,
)
from app.services.analytics.values import pad_anchor_dates

__all__ = [
    "check_period_series_sql",
    "check_type_distribution_sql",
    "check_view_distribution_sql",
    "collect_check_anchor_dates_sql",
    "collect_combined_anchor_dates_sql",
    "collect_filter_option_auditors_sql",
    "collect_filter_option_departments_sql",
    "collect_filter_option_recommendation_auditors_sql",
    "collect_recommendation_anchor_dates_sql",
    "completion_share_from_summary",
    "count_checks",
    "count_recommendations",
    "department_map_from_pairs",
    "dva_auditor_documents_from_rows",
    "dva_auditor_documents_sql",
    "dva_auditor_load_from_counts",
    "dva_auditor_load_sql",
    "dva_auditor_matrix_sql",
    "dva_auditor_recommendation_profiles_sql",
    "dva_document_readiness_sql",
    "dva_portfolio_series_sql",
    "dva_recommendation_profiles_from_rows",
    "grouped_named_counts_sql",
    "load_check_department_pairs",
    "load_check_serial_numbers",
    "load_effectiveness_matrix_rows",
    "load_recommendation_department_rows",
    "recommendation_check_links_sql",
    "recommendation_completed_during_audit_by_check_sql",
    "recommendation_deadline_extensions_by_check_sql",
    "recommendation_indicator_distribution_sql",
    "recommendation_materiality_matrix_sql",
    "recommendation_object_distribution_sql",
    "recommendation_period_series_sql",
    "recommendation_status_matrix_sql",
    "summarize_checks_sql",
    "summarize_recommendations_sql",
]


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


async def summarize_recommendations_sql(session: AsyncSession, **filters: Any) -> RecommendationsSummary:
    statement = apply_recommendation_filters(
        select(
            func.count().label("total"),
            *recommendation_status_count_columns(),
            *recommendation_materiality_count_columns(),
            count_if(Recommendation.additional_status == "on_time", "on_time"),
            count_if(Recommendation.additional_status == "deadline_violated", "deadline_violated"),
            count_if(Recommendation.additional_status == "on_control", "add_on_control"),
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
        ),
        with_extensions=int(row.with_extensions),
        with_completion_date=int(row.with_completion_date),
        completion_rate=round((completed / total) * 100) if total else 0,
        violation_rate=round((deadline_violated / total) * 100) if total else 0,
    )


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


async def load_effectiveness_matrix_rows(session: AsyncSession, **filters: Any) -> list[Check]:
    statement = apply_check_filters(
        select(Check).order_by(Check.serial_number.asc()),
        **filters,
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


async def load_check_department_pairs(
    session: AsyncSession,
    **filters: Any,
) -> list[tuple[int, list[str]]]:
    check_ids_subquery = apply_check_filters(select(Check.id), **filters).subquery()
    statement = select(check_ids_subquery.c.id.label("check_id"), Recommendation.audit_object).select_from(
        check_ids_subquery.outerjoin(
            Recommendation,
            Recommendation.check_id == check_ids_subquery.c.id,
        ),
    )
    rows = await fetch_all(session, statement)
    return [(int(row.check_id), list(row.audit_object or [])) for row in rows if row.check_id is not None]


async def load_recommendation_department_rows(
    session: AsyncSession,
    **filters: Any,
) -> list[tuple[str, list[str], str]]:
    """Return (serial_number, audit_object, materiality_level) for filtered recommendations."""
    statement = apply_recommendation_filters(
        select(
            Recommendation.serial_number,
            Recommendation.audit_object,
            Recommendation.materiality_level,
        ),
        **filters,
    )
    rows = await fetch_all(session, statement)
    return [
        (str(row.serial_number or "").strip(), list(row.audit_object or []), str(row.materiality_level))
        for row in rows
    ]


async def load_check_serial_numbers(session: AsyncSession, **filters: Any) -> list[str]:
    statement = apply_check_filters(select(Check.serial_number), **filters)
    rows = await fetch_all(session, statement)
    return [str(row.serial_number).strip() for row in rows if row.serial_number]


async def collect_filter_option_auditors_sql(session: AsyncSession) -> list[str]:
    values: set[str] = set()
    for column in (Check.check_leader, Recommendation.auditor, Recommendation.manager):
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
    from app.db.department_names import DEPARTMENTS

    return sorted(DEPARTMENTS, key=lambda value: value.casefold())


async def collect_check_anchor_dates_sql(session: AsyncSession) -> list[str]:
    return pad_anchor_dates(await column_dates(session, Check.start_date))


async def collect_recommendation_anchor_dates_sql(session: AsyncSession) -> list[str]:
    return pad_anchor_dates(await column_dates(session, Recommendation.deadline))


async def collect_combined_anchor_dates_sql(session: AsyncSession) -> list[str]:
    check_dates = await column_dates(session, Check.start_date)
    rec_dates = await column_dates(session, Recommendation.deadline)
    return pad_anchor_dates(check_dates + rec_dates)


def _ensure_portfolio_point(
    merged: dict[str, DvaPortfolioPoint],
    period,
) -> DvaPortfolioPoint:
    current = merged.get(period.key)
    if current is None:
        current = DvaPortfolioPoint(
            key=period.key,
            label=period.label,
            sort_key=period.sort_key,
            checks=0,
            recommendations=0,
        )
        merged[period.key] = current
    return current


async def dva_portfolio_series_sql(
    session: AsyncSession,
    granularity: PeriodGranularity,
    *,
    check_filters: dict[str, Any],
    recommendation_filters: dict[str, Any],
) -> list[DvaPortfolioPoint]:
    check_group = period_group_columns(Check.start_date, granularity)
    check_statement = apply_check_filters(
        select(*check_group, func.count().label("checks")).select_from(Check).group_by(*check_group),
        **check_filters,
    )
    rec_group = period_group_columns(Recommendation.deadline, granularity)
    rec_statement = apply_recommendation_filters(
        select(*rec_group, func.count().label("recommendations")).select_from(Recommendation).group_by(*rec_group),
        **recommendation_filters,
    )
    merged: dict[str, DvaPortfolioPoint] = {}
    for row in await fetch_all(session, check_statement):
        period = period_from_sql_row(row, granularity)
        _ensure_portfolio_point(merged, period).checks = int(row.checks)
    for row in await fetch_all(session, rec_statement):
        period = period_from_sql_row(row, granularity)
        _ensure_portfolio_point(merged, period).recommendations = int(row.recommendations)
    return sorted(merged.values(), key=lambda row: row.sort_key)


def dva_auditor_load_from_counts(
    check_rows: list[NamedCount],
    rec_rows: list[NamedCount],
) -> list[DvaAuditorLoadRow]:
    check_counts = {row.name.strip() or WITHOUT_LEADER: row.value for row in check_rows}
    rec_counts = {row.name.strip() or WITHOUT_AUDITOR: row.value for row in rec_rows}
    names = set(check_counts) | set(rec_counts)
    rows = [
        DvaAuditorLoadRow(
            name=name,
            checks=check_counts.get(name, 0),
            recommendations=rec_counts.get(name, 0),
            value=check_counts.get(name, 0) + rec_counts.get(name, 0),
        )
        for name in names
        if check_counts.get(name, 0) > 0 or rec_counts.get(name, 0) > 0
    ]
    return sorted(rows, key=lambda row: (-row.value, row.name))


async def dva_auditor_load_sql(
    session: AsyncSession,
    *,
    check_filters: dict[str, Any],
    recommendation_filters: dict[str, Any],
) -> list[DvaAuditorLoadRow]:
    check_rows = await grouped_named_counts_sql(
        session,
        model=Check,
        column=Check.check_leader,
        filters=check_filter_conditions(**check_filters),
        positive_only=True,
    )
    rec_rows = await grouped_named_counts_sql(
        session,
        model=Recommendation,
        column=Recommendation.auditor,
        filters=recommendation_filter_conditions(**recommendation_filters),
        positive_only=True,
    )
    return dva_auditor_load_from_counts(check_rows, rec_rows)


def _auditor_display_name(raw: Any, fallback: str) -> str:
    value = str(raw or "").strip()
    return value or fallback


def dva_recommendation_profiles_from_rows(
    rows: Any,
) -> tuple[list[DvaAuditorMaterialityRow], list[DvaAuditorExecutionRow], list[DvaAuditorTimelinessRow]]:
    impact: list[DvaAuditorMaterialityRow] = []
    execution: list[DvaAuditorExecutionRow] = []
    timeliness: list[DvaAuditorTimelinessRow] = []
    for row in rows:
        name = _auditor_display_name(row.name, WITHOUT_AUDITOR)
        total = int(row.total)
        if total <= 0:
            continue
        low = int(row.low)
        medium = int(row.medium)
        high = int(row.high)
        completed = int(row.completed)
        in_progress = int(row.in_progress)
        on_control = int(row.on_control)
        unresolved = int(row.unresolved)
        on_time = int(row.on_time)
        deadline_violated = int(row.deadline_violated)
        add_on_control = int(row.add_on_control)
        impact.append(
            DvaAuditorMaterialityRow(name=name, low=low, medium=medium, high=high, total=total)
        )
        execution.append(
            DvaAuditorExecutionRow(
                name=name,
                completed=completed,
                in_progress=in_progress,
                on_control=on_control,
                unresolved=unresolved,
                total=total,
            )
        )
        timeliness.append(
            DvaAuditorTimelinessRow(
                name=name,
                on_time=on_time,
                deadline_violated=deadline_violated,
                on_control=add_on_control,
                total=total,
                violation_rate=round((deadline_violated / total) * 100) if total else 0,
            )
        )
    impact.sort(key=lambda item: (-item.high, -item.total, item.name))
    execution.sort(key=lambda item: (-(item.unresolved + item.in_progress), -item.total, item.name))
    timeliness.sort(key=lambda item: (-item.deadline_violated, -item.violation_rate, item.name))
    return impact, execution, timeliness


async def dva_auditor_recommendation_profiles_sql(
    session: AsyncSession,
    **filters: Any,
) -> tuple[list[DvaAuditorMaterialityRow], list[DvaAuditorExecutionRow], list[DvaAuditorTimelinessRow]]:
    statement = apply_recommendation_filters(
        select(
            Recommendation.auditor.label("name"),
            func.count().label("total"),
            *recommendation_status_count_columns(),
            *recommendation_materiality_count_columns(),
            count_if(Recommendation.additional_status == "on_time", "on_time"),
            count_if(Recommendation.additional_status == "deadline_violated", "deadline_violated"),
            count_if(Recommendation.additional_status == "on_control", "add_on_control"),
        )
        .select_from(Recommendation)
        .group_by(Recommendation.auditor),
        **filters,
    )
    return dva_recommendation_profiles_from_rows(await fetch_all(session, statement))


def dva_auditor_documents_from_rows(rows: Any) -> list[DvaAuditorDocumentRow]:
    result: list[DvaAuditorDocumentRow] = []
    for row in rows:
        checks = int(row.checks)
        if checks <= 0:
            continue
        order_filled = int(row.order_filled)
        program_filled = int(row.program_filled)
        az_filled = int(row.az_filled)
        dz_filled = int(row.dz_filled)
        slots = checks * 4
        filled = order_filled + program_filled + az_filled + dz_filled
        result.append(
            DvaAuditorDocumentRow(
                name=_auditor_display_name(row.name, WITHOUT_LEADER),
                checks=checks,
                order_filled=order_filled,
                program_filled=program_filled,
                az_filled=az_filled,
                dz_filled=dz_filled,
                readiness=int(filled / slots * 100 + 0.5) if slots else 0,
            )
        )
    return sorted(result, key=lambda item: (item.readiness, -item.checks, item.name))


async def dva_auditor_documents_sql(session: AsyncSession, **filters: Any) -> list[DvaAuditorDocumentRow]:
    statement = apply_check_filters(
        select(
            Check.check_leader.label("name"),
            func.count().label("checks"),
            count_if(
                or_(Check.order_document_number.isnot(None), Check.order_document_date.isnot(None)),
                "order_filled",
            ),
            count_if(
                or_(Check.program_document_number.isnot(None), Check.program_document_date.isnot(None)),
                "program_filled",
            ),
            count_if(
                or_(Check.az_document_number.isnot(None), Check.az_document_date.isnot(None)),
                "az_filled",
            ),
            count_if(
                or_(Check.dz_document_number.isnot(None), Check.dz_document_date.isnot(None)),
                "dz_filled",
            ),
        )
        .select_from(Check)
        .group_by(Check.check_leader),
        **filters,
    )
    return dva_auditor_documents_from_rows(await fetch_all(session, statement))


async def dva_document_readiness_sql(session: AsyncSession, **filters: Any) -> list[DocumentReadinessRow]:
    statement = apply_check_filters(
        select(
            func.count().label("total"),
            count_if(
                or_(Check.order_document_number.isnot(None), Check.order_document_date.isnot(None)),
                "order_filled",
            ),
            count_if(
                or_(Check.program_document_number.isnot(None), Check.program_document_date.isnot(None)),
                "program_filled",
            ),
            count_if(
                or_(Check.az_document_number.isnot(None), Check.az_document_date.isnot(None)),
                "az_filled",
            ),
            count_if(
                or_(Check.dz_document_number.isnot(None), Check.dz_document_date.isnot(None)),
                "dz_filled",
            ),
        ).select_from(Check),
        **filters,
    )
    row = await fetch_one(session, statement)
    total = int(row.total)
    docs = [
        ("Приказ", int(row.order_filled)),
        ("Программа", int(row.program_filled)),
        ("АЗ", int(row.az_filled)),
        ("ДЗ", int(row.dz_filled)),
    ]
    return [
        DocumentReadinessRow(name=name, filled=filled, empty=max(total - filled, 0))
        for name, filled in docs
    ]


async def dva_auditor_matrix_sql(
    session: AsyncSession,
    granularity: PeriodGranularity,
    *,
    check_filters: dict[str, Any],
    recommendation_filters: dict[str, Any],
) -> DvaAuditorMatrix:
    check_group = period_group_columns(Check.start_date, granularity)
    check_statement = apply_check_filters(
        select(
            Check.check_leader.label("auditor"),
            *check_group,
            func.count().label("checks"),
        )
        .select_from(Check)
        .group_by(Check.check_leader, *check_group),
        **check_filters,
    )
    rec_group = period_group_columns(Recommendation.deadline, granularity)
    rec_statement = apply_recommendation_filters(
        select(
            Recommendation.auditor.label("auditor"),
            *rec_group,
            func.count().label("recommendations"),
        )
        .select_from(Recommendation)
        .group_by(Recommendation.auditor, *rec_group),
        **recommendation_filters,
    )

    period_map: dict[str, PeriodBucketSchema] = {}
    row_map: dict[str, DvaAuditorMatrixRow] = {}

    def touch(auditor_raw: str) -> DvaAuditorMatrixRow:
        auditor = auditor_raw.strip() or UNSPECIFIED
        current = row_map.get(auditor)
        if current is None:
            current = DvaAuditorMatrixRow(auditor=auditor, total=0, by_period={})
            row_map[auditor] = current
        return current

    def add_cell(row: Any, *, checks: int = 0, recommendations: int = 0) -> None:
        period = period_from_sql_row(row, granularity)
        period_map[period.key] = PeriodBucketSchema(
            key=period.key,
            label=period.label,
            sort_key=period.sort_key,
        )
        matrix_row = touch(str(row.auditor))
        cell = matrix_row.by_period.get(period.key) or DvaAuditorMatrixCell(checks=0, recommendations=0)
        cell.checks += checks
        cell.recommendations += recommendations
        matrix_row.by_period[period.key] = cell
        matrix_row.total += checks + recommendations

    for row in await fetch_all(session, check_statement):
        add_cell(row, checks=int(row.checks))
    for row in await fetch_all(session, rec_statement):
        add_cell(row, recommendations=int(row.recommendations))

    return DvaAuditorMatrix(
        periods=sorted(period_map.values(), key=lambda item: item.sort_key),
        rows=sorted(row_map.values(), key=lambda item: (-item.total, item.auditor)),
    )
