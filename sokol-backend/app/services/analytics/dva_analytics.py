from __future__ import annotations

from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check, CheckStatus
from app.models.recommendations import Recommendation
from app.schemas.analytics import (
    ChecksAnalyticsFilterOptions,
    ChecksSummary,
    DocumentReadinessRow,
    DvaAnalyticsResponse,
    DvaAuditorLoadRow,
    DvaAuditorMatrix,
    DvaAuditorMatrixCell,
    DvaAuditorMatrixRow,
    DvaPortfolioPoint,
    NamedCount,
    PeriodBucketSchema,
    PeriodGranularity,
    RecommendationsSummary,
)
from app.services.analytics.common import (
    collect_analytics_auditors,
    collect_audit_objects,
    filter_checks,
    filter_recommendations,
    load_checks_with_recommendations,
    load_recommendations,
    pad_anchor_dates,
)
from app.services.analytics.period import get_period_bucket
from app.services.analytics.recommendations_analytics import summarize_recommendations


def _summarize_checks(checks: list[Check]) -> ChecksSummary:
    by_status = {
        CheckStatus.NOT_STARTED: 0,
        CheckStatus.IN_PROGRESS: 0,
        CheckStatus.COMPLETED: 0,
    }
    for check in checks:
        by_status[check.status] += 1
    return ChecksSummary(
        total=len(checks),
        not_started=by_status[CheckStatus.NOT_STARTED],
        in_progress=by_status[CheckStatus.IN_PROGRESS],
        completed=by_status[CheckStatus.COMPLETED],
    )


def _completion_share(checks: list[Check]) -> int:
    if not checks:
        return 0
    completed = sum(1 for check in checks if check.status == CheckStatus.COMPLETED)
    return round((completed / len(checks)) * 100)


def _check_period_totals(checks: list[Check], granularity: PeriodGranularity) -> dict[str, DvaPortfolioPoint]:
    result: dict[str, DvaPortfolioPoint] = {}
    for check in checks:
        if check.start_date is None:
            continue
        period = get_period_bucket(check.start_date, granularity)
        current = result.get(period.key)
        if current is None:
            current = DvaPortfolioPoint(
                key=period.key,
                label=period.label,
                sort_key=period.sort_key,
                checks=0,
                recommendations=0,
            )
            result[period.key] = current
        current.checks += 1
    return result


def _merge_recommendation_periods(
    base: dict[str, DvaPortfolioPoint],
    recommendations: list[Recommendation],
    granularity: PeriodGranularity,
) -> list[DvaPortfolioPoint]:
    for item in recommendations:
        if item.deadline is None:
            continue
        period = get_period_bucket(item.deadline, granularity)
        current = base.get(period.key)
        if current is None:
            current = DvaPortfolioPoint(
                key=period.key,
                label=period.label,
                sort_key=period.sort_key,
                checks=0,
                recommendations=0,
            )
            base[period.key] = current
        current.recommendations += 1
    return sorted(base.values(), key=lambda row: row.sort_key)


def _check_auditor_distribution(checks: list[Check]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for check in checks:
        name = check.check_leader.strip() or "Без руководителя"
        counts[name] += 1
    return counts


def _recommendation_auditor_distribution(recommendations: list[Recommendation]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for item in recommendations:
        name = item.auditor.strip() or "Без аудитора"
        counts[name] += 1
    return counts


def _auditor_load(checks: list[Check], recommendations: list[Recommendation]) -> list[DvaAuditorLoadRow]:
    check_counts = _check_auditor_distribution(checks)
    rec_counts = _recommendation_auditor_distribution(recommendations)
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


def _document_readiness(checks: list[Check]) -> list[DocumentReadinessRow]:
    docs = [
        ("Приказ", lambda c: bool(c.order_document_number or c.order_document_date)),
        ("Программа", lambda c: bool(c.program_document_number or c.program_document_date)),
        ("АЗ", lambda c: bool(c.az_document_number or c.az_document_date)),
        ("ДЗ", lambda c: bool(c.dz_document_number or c.dz_document_date)),
    ]
    rows: list[DocumentReadinessRow] = []
    for name, predicate in docs:
        filled = sum(1 for check in checks if predicate(check))
        rows.append(
            DocumentReadinessRow(
                name=name,
                filled=filled,
                empty=max(len(checks) - filled, 0),
            )
        )
    return rows


def _auditor_matrix(
    checks: list[Check],
    recommendations: list[Recommendation],
    granularity: PeriodGranularity,
) -> DvaAuditorMatrix:
    period_map: dict[str, PeriodBucketSchema] = {}
    row_map: dict[str, DvaAuditorMatrixRow] = {}

    def touch(auditor_raw: str) -> DvaAuditorMatrixRow:
        auditor = auditor_raw.strip() or "Не указан"
        row = row_map.get(auditor)
        if row is None:
            row = DvaAuditorMatrixRow(auditor=auditor, total=0, by_period={})
            row_map[auditor] = row
        return row

    def add(auditor_raw: str, period: PeriodBucketSchema, field: str) -> None:
        period_map[period.key] = period
        row = touch(auditor_raw)
        cell = row.by_period.get(period.key) or DvaAuditorMatrixCell(checks=0, recommendations=0)
        if field == "checks":
            cell.checks += 1
        else:
            cell.recommendations += 1
        row.by_period[period.key] = cell
        row.total += 1

    for check in checks:
        if check.start_date is None:
            continue
        period = get_period_bucket(check.start_date, granularity)
        add(
            check.check_leader,
            PeriodBucketSchema(key=period.key, label=period.label, sort_key=period.sort_key),
            "checks",
        )

    for item in recommendations:
        if item.deadline is None:
            continue
        period = get_period_bucket(item.deadline, granularity)
        add(
            item.auditor,
            PeriodBucketSchema(key=period.key, label=period.label, sort_key=period.sort_key),
            "recommendations",
        )

    return DvaAuditorMatrix(
        periods=sorted(period_map.values(), key=lambda row: row.sort_key),
        rows=sorted(row_map.values(), key=lambda row: (-row.total, row.auditor)),
    )


def _named_counts(counts: dict[str, int]) -> list[NamedCount]:
    return [
        NamedCount(name=name, value=value)
        for name, value in sorted(counts.items(), key=lambda row: (-row[1], row[0]))
        if value > 0
    ]


def _audit_object_distribution(recommendations: list[Recommendation]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for item in recommendations:
        name = (item.audit_object or "").strip() or "Без объекта"
        counts[name] += 1
    return _named_counts(counts)


async def build_dva_analytics(
    session: AsyncSession,
    *,
    granularity: PeriodGranularity = "year",
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
) -> DvaAnalyticsResponse:
    checks = await load_checks_with_recommendations(session)
    recommendations = await load_recommendations(session)

    filtered_checks = filter_checks(
        checks,
        auditors=auditors,
        departments=departments,
        years=years,
        quarters=quarters,
        months=months,
    )
    filtered_recommendations = filter_recommendations(
        recommendations,
        auditors=auditors,
        departments=departments,
        years=years,
        quarters=quarters,
        months=months,
    )

    check_summary = _summarize_checks(filtered_checks)
    rec_summary = summarize_recommendations(filtered_recommendations)
    portfolio = _merge_recommendation_periods(
        _check_period_totals(filtered_checks, granularity),
        filtered_recommendations,
        granularity,
    )
    auditor_load = _auditor_load(filtered_checks, filtered_recommendations)
    department_map = _audit_object_distribution(filtered_recommendations)

    return DvaAnalyticsResponse(
        universe_checks_total=len(checks),
        universe_recommendations_total=len(recommendations),
        filtered_checks_total=len(filtered_checks),
        filtered_recommendations_total=len(filtered_recommendations),
        granularity=granularity,
        check_summary=check_summary,
        recommendation_summary=rec_summary,
        completion_share=_completion_share(filtered_checks),
        portfolio_series=portfolio,
        auditor_load=auditor_load,
        auditor_matrix=_auditor_matrix(filtered_checks, filtered_recommendations, granularity),
        document_readiness=_document_readiness(filtered_checks),
        auditor_checks_treemap=_named_counts(_check_auditor_distribution(filtered_checks)),
        auditor_recommendations_treemap=_named_counts(
            _recommendation_auditor_distribution(filtered_recommendations)
        ),
        department_map=department_map,
        filter_options=ChecksAnalyticsFilterOptions(
            auditors=collect_analytics_auditors(checks, recommendations),
            departments=collect_audit_objects(recommendations),
            anchor_dates=pad_anchor_dates(
                [check.start_date for check in checks if check.start_date]
                + [item.deadline for item in recommendations if item.deadline]
            ),
        ),
    )
