from __future__ import annotations

from collections import defaultdict
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check, CheckStatus
from app.schemas.analytics import (
    ChecksAnalyticsFilterOptions,
    ChecksAnalyticsResponse,
    EffectivenessMatrixRow,
    EffectivenessRatings,
    EffectivenessTones,
    NamedCount,
    PeriodCount,
    PeriodGranularity,
)
from app.services.analytics.common import (
    check_department_map,
    collect_analytics_auditors,
    collect_audit_objects,
    completion_share,
    filter_checks,
    load_checks_with_recommendations,
    load_recommendations,
    pad_anchor_dates,
    summarize_checks,
)
from app.services.analytics.period import get_period_bucket

CHECK_TYPE_PLURAL_LABELS = {
    "planned": "Плановые",
    "unscheduled": "Внеплановые",
    "thematic": "Контрольные",
}


def _resolve_effectiveness_tone(value: str | None) -> Literal["effective", "sufficient", "insufficient", "ineffective", "unset"]:
    raw = " ".join((value or "").strip().lower().split())
    if not raw or raw in {"не указано", "не оценивалось"}:
        return "unset"
    if raw == "эффективно":
        return "effective"
    if raw == "достаточно эффективно":
        return "sufficient"
    if raw == "недостаточно эффективно":
        return "insufficient"
    if raw in {"неэффективно", "не эффективно"}:
        return "ineffective"
    return "unset"


def _period_series(checks: list[Check], granularity: PeriodGranularity) -> list[PeriodCount]:
    buckets: dict[str, PeriodCount] = {}
    for check in checks:
        period = get_period_bucket(check.start_date, granularity)
        current = buckets.get(period.key)
        if current is None:
            current = PeriodCount(
                key=period.key,
                label=period.label,
                sort_key=period.sort_key,
                total=0,
                not_started=0,
                in_progress=0,
                completed=0,
                cumulative=0,
            )
            buckets[period.key] = current
        current.total += 1
        if check.status == CheckStatus.NOT_STARTED:
            current.not_started += 1
        elif check.status == CheckStatus.IN_PROGRESS:
            current.in_progress += 1
        else:
            current.completed += 1

    ordered = sorted(buckets.values(), key=lambda item: item.sort_key)
    running = 0
    for item in ordered:
        running += item.total
        item.cumulative = running
    return ordered


def _view_distribution(checks: list[Check]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for check in checks:
        counts[check.check_view] += 1
    return [
        NamedCount(name=name, value=value)
        for name, value in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _type_distribution(checks: list[Check]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for check in checks:
        counts[check.check_type] += 1
    return [
        NamedCount(
            name=CHECK_TYPE_PLURAL_LABELS.get(check_type, check_type),
            value=value,
        )
        for check_type, value in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _effectiveness_matrix(checks: list[Check]) -> list[EffectivenessMatrixRow]:
    ordered = sorted(checks, key=lambda item: item.serial_number)
    rows: list[EffectivenessMatrixRow] = []
    for check in ordered:
        ratings = EffectivenessRatings(
            process=(check.process_effectiveness or "").strip(),
            svk=(check.svk_effectiveness or "").strip(),
            sur=(check.sur_effectiveness or "").strip(),
            svik=(check.svik_effectiveness or "").strip(),
        )
        rows.append(
            EffectivenessMatrixRow(
                id=str(check.id),
                key=check.serial_number,
                short_name=(check.short_name or "").strip(),
                name=check.check_name,
                ratings=ratings,
                tones=EffectivenessTones(
                    process=_resolve_effectiveness_tone(ratings.process),
                    svk=_resolve_effectiveness_tone(ratings.svk),
                    sur=_resolve_effectiveness_tone(ratings.sur),
                    svik=_resolve_effectiveness_tone(ratings.svik),
                ),
            )
        )
    return rows


async def build_checks_analytics(
    session: AsyncSession,
    *,
    granularity: PeriodGranularity = "year",
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
) -> ChecksAnalyticsResponse:
    checks = await load_checks_with_recommendations(session)
    recommendations = await load_recommendations(session)

    filtered = filter_checks(
        checks,
        auditors=auditors,
        departments=departments,
        years=years,
        quarters=quarters,
        months=months,
    )
    summary = summarize_checks(filtered)
    return ChecksAnalyticsResponse(
        universe_total=len(checks),
        filtered_total=len(filtered),
        granularity=granularity,
        summary=summary,
        completion_share=completion_share(summary.total, summary.completed),
        period_series=_period_series(filtered, granularity),
        view_distribution=_view_distribution(filtered),
        type_distribution=_type_distribution(filtered),
        department_map=check_department_map(filtered),
        effectiveness_matrix=_effectiveness_matrix(filtered),
        filter_options=ChecksAnalyticsFilterOptions(
            auditors=collect_analytics_auditors(checks, recommendations),
            departments=collect_audit_objects(recommendations),
            anchor_dates=pad_anchor_dates(
                [check.start_date for check in checks if check.start_date]
            ),
        ),
    )
