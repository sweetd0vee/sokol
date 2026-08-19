"""SQL-side aggregates for analytics dashboards."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import case, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check, CheckStatus
from app.models.departments import Department
from app.models.recommendations import Recommendation
from app.schemas.analytics import (
    ChecksSummary,
    DocumentReadinessRow,
    DvaAuditorLoadRow,
    DvaAuditorMatrix,
    DvaAuditorMatrixCell,
    DvaAuditorMatrixRow,
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
)
from app.services.analytics.common import (
    completion_share,
    named_counts,
    pad_anchor_dates,
    parse_audit_object_parts,
)
from app.services.analytics.period import get_period_bucket
from app.services.analytics.sql_filters import (
    apply_check_filters,
    apply_recommendation_filters,
    check_filter_conditions,
    recommendation_filter_conditions,
)


def _period_group_columns(date_column, granularity: PeriodGranularity):
    year_col = extract("year", date_column).label("bucket_year")
    if granularity == "year":
        return (year_col,)
    if granularity == "quarter":
        return (year_col, extract("quarter", date_column).label("bucket_quarter"))
    return (year_col, extract("month", date_column).label("bucket_month"))


def _bucket_date_from_row(row: Any, granularity: PeriodGranularity) -> date:
    year = int(row.bucket_year)
    if granularity == "year":
        return date(year, 1, 1)
    if granularity == "quarter":
        quarter = int(row.bucket_quarter)
        return date(year, (quarter - 1) * 3 + 1, 1)
    return date(year, int(row.bucket_month), 1)


async def count_checks(session: AsyncSession, *, filtered: bool = False, **filters: Any) -> int:
    statement = select(func.count()).select_from(Check)
    if filtered:
        statement = apply_check_filters(statement, **filters)
    result = await session.execute(statement)
    return int(result.scalar_one())


async def count_recommendations(session: AsyncSession, *, filtered: bool = False, **filters: Any) -> int:
    statement = select(func.count()).select_from(Recommendation)
    if filtered:
        statement = apply_recommendation_filters(statement, **filters)
    result = await session.execute(statement)
    return int(result.scalar_one())


async def summarize_checks_sql(session: AsyncSession, **filters: Any) -> ChecksSummary:
    statement = apply_check_filters(
        select(
            func.count().label("total"),
            func.count()
            .filter(Check.status == CheckStatus.NOT_STARTED)
            .label("not_started"),
            func.count()
            .filter(Check.status == CheckStatus.IN_PROGRESS)
            .label("in_progress"),
            func.count()
            .filter(Check.status == CheckStatus.COMPLETED)
            .label("completed"),
        ).select_from(Check),
        **filters,
    )
    row = (await session.execute(statement)).one()
    return ChecksSummary(
        total=int(row.total),
        not_started=int(row.not_started),
        in_progress=int(row.in_progress),
        completed=int(row.completed),
    )


async def summarize_recommendations_sql(session: AsyncSession, **filters: Any) -> RecommendationsSummary:
    has_extensions = or_(
        Recommendation.deadline_extensions.isnot(None),
        Recommendation.extension_1_date.isnot(None),
        Recommendation.extension_1_comment.isnot(None),
        Recommendation.extension_2_comment.isnot(None),
    )
    statement = apply_recommendation_filters(
        select(
            func.count().label("total"),
            func.count().filter(Recommendation.status == "completed").label("completed"),
            func.count().filter(Recommendation.status == "unresolved").label("unresolved"),
            func.count().filter(Recommendation.status == "on_control").label("on_control"),
            func.count().filter(Recommendation.status == "in_progress").label("in_progress"),
            func.count().filter(Recommendation.materiality_level == "низкий").label("low"),
            func.count().filter(Recommendation.materiality_level == "средний").label("medium"),
            func.count().filter(Recommendation.materiality_level == "высокий").label("high"),
            func.count().filter(Recommendation.additional_status == "on_time").label("on_time"),
            func.count()
            .filter(Recommendation.additional_status == "deadline_violated")
            .label("deadline_violated"),
            func.count().filter(Recommendation.additional_status == "on_control").label("add_on_control"),
            func.count().filter(has_extensions).label("with_extensions"),
            func.count()
            .filter(Recommendation.actual_completion_date.isnot(None))
            .label("with_completion_date"),
        ).select_from(Recommendation),
        **filters,
    )
    row = (await session.execute(statement)).one()
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
    group_cols = _period_group_columns(Check.start_date, granularity)
    statement = apply_check_filters(
        select(
            *group_cols,
            func.count().label("total"),
            func.count()
            .filter(Check.status == CheckStatus.NOT_STARTED)
            .label("not_started"),
            func.count()
            .filter(Check.status == CheckStatus.IN_PROGRESS)
            .label("in_progress"),
            func.count()
            .filter(Check.status == CheckStatus.COMPLETED)
            .label("completed"),
        )
        .select_from(Check)
        .group_by(*group_cols)
        .order_by(*group_cols),
        **filters,
    )
    rows = (await session.execute(statement)).all()
    buckets: list[PeriodCount] = []
    for row in rows:
        period = get_period_bucket(_bucket_date_from_row(row, granularity), granularity)
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
    buckets.sort(key=lambda item: item.sort_key)
    running = 0
    for item in buckets:
        running += item.total
        item.cumulative = running
    return buckets


async def recommendation_period_series_sql(
    session: AsyncSession,
    granularity: PeriodGranularity,
    **filters: Any,
) -> list[RecommendationPeriodCount]:
    group_cols = _period_group_columns(Recommendation.deadline, granularity)
    statement = apply_recommendation_filters(
        select(
            *group_cols,
            func.count().label("total"),
            func.count().filter(Recommendation.status == "completed").label("completed"),
            func.count().filter(Recommendation.status == "unresolved").label("unresolved"),
            func.count().filter(Recommendation.status == "on_control").label("on_control"),
            func.count().filter(Recommendation.status == "in_progress").label("in_progress"),
            func.count().filter(Recommendation.materiality_level == "низкий").label("low"),
            func.count().filter(Recommendation.materiality_level == "средний").label("medium"),
            func.count().filter(Recommendation.materiality_level == "высокий").label("high"),
        )
        .select_from(Recommendation)
        .group_by(*group_cols)
        .order_by(*group_cols),
        **filters,
    )
    rows = (await session.execute(statement)).all()
    buckets: list[RecommendationPeriodCount] = []
    for row in rows:
        period = get_period_bucket(_bucket_date_from_row(row, granularity), granularity)
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
    buckets.sort(key=lambda row: row.sort_key)
    running = 0
    completed_running = 0
    for row in buckets:
        running += row.total
        completed_running += row.completed
        row.cumulative = running
        row.cumulative_completed = completed_running
    return buckets


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
    rows = (await session.execute(statement)).all()
    counts = {str(row.name): int(row.value) for row in rows if row.name is not None}
    return named_counts(counts, positive_only=positive_only)


async def check_view_distribution_sql(session: AsyncSession, **filters: Any) -> list[NamedCount]:
    return await grouped_named_counts_sql(
        session,
        model=Check,
        column=Check.check_view,
        filters=check_filter_conditions(**filters),
    )


async def check_type_distribution_sql(session: AsyncSession, **filters: Any) -> list[NamedCount]:
    from app.services.analytics.checks_analytics import CHECK_TYPE_PLURAL_LABELS

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
    from app.services.analytics.recommendations_analytics import INDICATOR_COLORS, INDICATOR_LABELS

    rows = await grouped_named_counts_sql(
        session,
        model=Recommendation,
        column=Recommendation.indicator,
        filters=recommendation_filter_conditions(**filters),
    )
    counts = {key: 0 for key in INDICATOR_LABELS}
    for row in rows:
        key = row.name or "не указан"
        counts[key] = counts.get(key, 0) + int(row.value)
    return [
        NamedCount(
            name=INDICATOR_LABELS.get(key, key),
            value=value,
            color=INDICATOR_COLORS.get(key),
        )
        for key, value in counts.items()
    ]


async def recommendation_object_distribution_sql(
    session: AsyncSession,
    **filters: Any,
) -> list[RecommendationObjectCount]:
    statement = select(Recommendation.audit_object, Recommendation.materiality_level).where(
        *recommendation_filter_conditions(**filters),
    )
    rows = (await session.execute(statement)).all()
    totals: dict[str, int] = defaultdict(int)
    materiality_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in rows:
        parts = parse_audit_object_parts(row.audit_object)
        departments = parts if parts else ["Без объекта"]
        materiality_level = str(row.materiality_level or "").strip().casefold() or "средний"
        if materiality_level not in {"низкий", "средний", "высокий"}:
            materiality_level = "средний"
        for department in departments:
            totals[department] += 1
            materiality_counts[department][materiality_level] += 1
    result = [
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
    return result


async def recommendation_materiality_matrix_sql(
    session: AsyncSession, **filters: Any
) -> list[MaterialityMatrixRow]:
    statement = apply_recommendation_filters(
        select(
            Recommendation.serial_number,
            Check.id.label("check_id"),
            Check.short_name,
            Check.check_name,
            func.count().filter(Recommendation.materiality_level == "высокий").label("high"),
            func.count().filter(Recommendation.materiality_level == "средний").label("medium"),
            func.count().filter(Recommendation.materiality_level == "низкий").label("low"),
            func.count().label("total"),
        )
        .select_from(Recommendation)
        .outerjoin(Check, Check.id == Recommendation.check_id)
        .group_by(Recommendation.serial_number, Check.id, Check.short_name, Check.check_name)
        .order_by(Recommendation.serial_number.asc()),
        **filters,
    )
    rows = (await session.execute(statement)).all()
    result: list[MaterialityMatrixRow] = []
    for row in rows:
        serial = str(row.serial_number or "").strip() or "Без проверки"
        check_id = row.check_id
        high = int(row.high or 0)
        medium = int(row.medium or 0)
        low = int(row.low or 0)
        result.append(
            MaterialityMatrixRow(
                id=str(check_id) if check_id is not None else serial,
                key=serial,
                short_name=str(row.short_name or "").strip(),
                name=str(row.check_name or "").strip() or serial,
                counts=RecommendationMaterialityCounts(
                    низкий=low,
                    средний=medium,
                    высокий=high,
                ),
                total=int(row.total or 0),
            )
        )
    return result


async def recommendation_check_links_sql(session: AsyncSession, **filters: Any) -> list[NamedCount]:
    rows = await grouped_named_counts_sql(
        session,
        model=Recommendation,
        column=Recommendation.serial_number,
        filters=recommendation_filter_conditions(**filters),
        limit=12,
    )
    return [
        NamedCount(name=(row.name.strip() if row.name and row.name.strip() else "Без проверки"), value=row.value)
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
    statement = (
        select(check_ids_subquery.c.id.label("check_id"), Recommendation.audit_object)
        .select_from(
            check_ids_subquery.outerjoin(
                Recommendation,
                Recommendation.check_id == check_ids_subquery.c.id,
            ),
        )
    )
    rows = (await session.execute(statement)).all()
    return [(int(row.check_id), list(row.audit_object or [])) for row in rows if row.check_id is not None]


def department_map_from_pairs(
    pairs: list[tuple[int, str | list[str]]],
    *,
    selected_departments: list[str] | None = None,
) -> list[NamedCount]:
    selected = {item.strip() for item in (selected_departments or []) if item.strip()}
    by_check: dict[int, set[str]] = defaultdict(set)
    for check_id, audit_object in pairs:
        by_check[check_id].update(parse_audit_object_parts(audit_object))
    counts: dict[str, int] = defaultdict(int)
    for departments in by_check.values():
        visible_departments = departments & selected if selected else departments
        if selected and not visible_departments:
            continue
        if not visible_departments:
            counts["Без департамента"] += 1
            continue
        for department in visible_departments:
            counts[department] += 1
    return named_counts(counts)


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
    rows = (await session.execute(statement)).all()
    return [
        (str(row.serial_number or "").strip(), list(row.audit_object or []), str(row.materiality_level))
        for row in rows
    ]


async def load_check_serial_numbers(session: AsyncSession, **filters: Any) -> list[str]:
    statement = apply_check_filters(select(Check.serial_number), **filters)
    rows = (await session.execute(statement)).all()
    return [str(row.serial_number).strip() for row in rows if row.serial_number]


async def collect_filter_option_auditors_sql(session: AsyncSession) -> list[str]:
    check_leaders = await session.execute(
        select(Check.check_leader).where(Check.check_leader.isnot(None), Check.check_leader != "").distinct()
    )
    auditors = await session.execute(
        select(Recommendation.auditor).where(Recommendation.auditor.isnot(None), Recommendation.auditor != "").distinct()
    )
    managers = await session.execute(
        select(Recommendation.manager).where(Recommendation.manager.isnot(None), Recommendation.manager != "").distinct()
    )
    values = {
        str(row[0]).strip()
        for row in (*check_leaders.all(), *auditors.all(), *managers.all())
        if row[0] and str(row[0]).strip()
    }
    return sorted(values, key=lambda value: value.casefold())


async def collect_filter_option_recommendation_auditors_sql(session: AsyncSession) -> list[str]:
    rows = await session.execute(
        select(Recommendation.auditor)
        .where(Recommendation.auditor.isnot(None), Recommendation.auditor != "")
        .distinct()
    )
    values = {str(row[0]).strip() for row in rows.all() if row[0] and str(row[0]).strip()}
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
    rows = await session.execute(select(Check.start_date).where(Check.start_date.isnot(None)))
    return pad_anchor_dates([row[0] for row in rows.all()])


async def collect_recommendation_anchor_dates_sql(session: AsyncSession) -> list[str]:
    rows = await session.execute(select(Recommendation.deadline).where(Recommendation.deadline.isnot(None)))
    return pad_anchor_dates([row[0] for row in rows.all()])


async def collect_combined_anchor_dates_sql(session: AsyncSession) -> list[str]:
    check_dates = [row[0] for row in (await session.execute(select(Check.start_date).where(Check.start_date.isnot(None)))).all()]
    rec_dates = [row[0] for row in (await session.execute(select(Recommendation.deadline).where(Recommendation.deadline.isnot(None)))).all()]
    return pad_anchor_dates(check_dates + rec_dates)


async def dva_portfolio_series_sql(
    session: AsyncSession,
    granularity: PeriodGranularity,
    *,
    check_filters: dict[str, Any],
    recommendation_filters: dict[str, Any],
) -> list[DvaPortfolioPoint]:
    check_group = _period_group_columns(Check.start_date, granularity)
    check_statement = apply_check_filters(
        select(*check_group, func.count().label("checks")).select_from(Check).group_by(*check_group),
        **check_filters,
    )
    rec_group = _period_group_columns(Recommendation.deadline, granularity)
    rec_statement = apply_recommendation_filters(
        select(*rec_group, func.count().label("recommendations")).select_from(Recommendation).group_by(*rec_group),
        **recommendation_filters,
    )
    merged: dict[str, DvaPortfolioPoint] = {}
    for row in (await session.execute(check_statement)).all():
        period = get_period_bucket(_bucket_date_from_row(row, granularity), granularity)
        merged[period.key] = DvaPortfolioPoint(
            key=period.key,
            label=period.label,
            sort_key=period.sort_key,
            checks=int(row.checks),
            recommendations=0,
        )
    for row in (await session.execute(rec_statement)).all():
        period = get_period_bucket(_bucket_date_from_row(row, granularity), granularity)
        current = merged.get(period.key)
        if current is None:
            merged[period.key] = DvaPortfolioPoint(
                key=period.key,
                label=period.label,
                sort_key=period.sort_key,
                checks=0,
                recommendations=int(row.recommendations),
            )
        else:
            current.recommendations = int(row.recommendations)
    return sorted(merged.values(), key=lambda row: row.sort_key)


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
    check_counts = {row.name.strip() or "Без руководителя": row.value for row in check_rows}
    rec_counts = {row.name.strip() or "Без аудитора": row.value for row in rec_rows}
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


async def dva_document_readiness_sql(session: AsyncSession, **filters: Any) -> list[DocumentReadinessRow]:
    statement = apply_check_filters(
        select(
            func.count().label("total"),
            func.count()
            .filter(or_(Check.order_document_number.isnot(None), Check.order_document_date.isnot(None)))
            .label("order_filled"),
            func.count()
            .filter(or_(Check.program_document_number.isnot(None), Check.program_document_date.isnot(None)))
            .label("program_filled"),
            func.count()
            .filter(or_(Check.az_document_number.isnot(None), Check.az_document_date.isnot(None)))
            .label("az_filled"),
            func.count()
            .filter(or_(Check.dz_document_number.isnot(None), Check.dz_document_date.isnot(None)))
            .label("dz_filled"),
        ).select_from(Check),
        **filters,
    )
    row = (await session.execute(statement)).one()
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
    check_group = _period_group_columns(Check.start_date, granularity)
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
    rec_group = _period_group_columns(Recommendation.deadline, granularity)
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
        auditor = auditor_raw.strip() or "Не указан"
        current = row_map.get(auditor)
        if current is None:
            current = DvaAuditorMatrixRow(auditor=auditor, total=0, by_period={})
            row_map[auditor] = current
        return current

    for row in (await session.execute(check_statement)).all():
        period = get_period_bucket(_bucket_date_from_row(row, granularity), granularity)
        period_schema = PeriodBucketSchema(key=period.key, label=period.label, sort_key=period.sort_key)
        period_map[period.key] = period_schema
        matrix_row = touch(str(row.auditor))
        cell = matrix_row.by_period.get(period.key) or DvaAuditorMatrixCell(checks=0, recommendations=0)
        cell.checks += int(row.checks)
        matrix_row.by_period[period.key] = cell
        matrix_row.total += int(row.checks)

    for row in (await session.execute(rec_statement)).all():
        period = get_period_bucket(_bucket_date_from_row(row, granularity), granularity)
        period_schema = PeriodBucketSchema(key=period.key, label=period.label, sort_key=period.sort_key)
        period_map[period.key] = period_schema
        matrix_row = touch(str(row.auditor))
        cell = matrix_row.by_period.get(period.key) or DvaAuditorMatrixCell(checks=0, recommendations=0)
        cell.recommendations += int(row.recommendations)
        matrix_row.by_period[period.key] = cell
        matrix_row.total += int(row.recommendations)

    return DvaAuditorMatrix(
        periods=sorted(period_map.values(), key=lambda item: item.sort_key),
        rows=sorted(row_map.values(), key=lambda item: (-item.total, item.auditor)),
    )


def completion_share_from_summary(summary: ChecksSummary) -> int:
    return completion_share(summary.total, summary.completed)
