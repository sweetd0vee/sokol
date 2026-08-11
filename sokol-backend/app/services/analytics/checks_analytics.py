from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.checks import Check, CheckStatus
from app.models.recommendations import Recommendation
from app.schemas.analytics import (
    ChecksAnalyticsFilterOptions,
    ChecksAnalyticsResponse,
    ChecksSummary,
    EffectivenessMatrixRow,
    EffectivenessRatings,
    EffectivenessTones,
    NamedCount,
    PeriodCount,
    PeriodGranularity,
)
from app.services.analytics.period import get_period_bucket, is_date_in_any_selected_periods

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


def _completion_share(total: int, completed: int) -> int:
    if total <= 0:
        return 0
    return round((completed / total) * 100)


def _filter_checks(
    checks: list[Check],
    *,
    auditors: list[str],
    departments: list[str],
    years: list[str],
    quarters: list[str],
    months: list[str],
) -> list[Check]:
    auditor_set = {item.strip() for item in auditors if item.strip()}
    department_set = {item.strip() for item in departments if item.strip()}

    result: list[Check] = []
    for check in checks:
        if check.start_date is None:
            continue
        if auditor_set:
            linked = check.recommendations or []
            matches_auditor = check.check_leader in auditor_set or any(
                item.auditor in auditor_set or item.manager in auditor_set for item in linked
            )
            if not matches_auditor:
                continue
        if not is_date_in_any_selected_periods(
            check.start_date,
            years=years,
            quarters=quarters,
            months=months,
        ):
            continue
        if department_set:
            linked = check.recommendations or []
            if not any(item.audit_object in department_set for item in linked):
                continue
        result.append(check)
    return result


def _summarize(checks: list[Check]) -> ChecksSummary:
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


def _department_map(checks: list[Check]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for check in checks:
        departments = {
            item.audit_object.strip()
            for item in (check.recommendations or [])
            if item.audit_object and item.audit_object.strip()
        }
        if not departments:
            counts["Без департамента"] += 1
            continue
        for department in departments:
            counts[department] += 1
    return [
        NamedCount(name=name, value=value)
        for name, value in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
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


def _filter_options(
    checks: list[Check],
    recommendations: list[Recommendation],
) -> ChecksAnalyticsFilterOptions:
    auditors = sorted(
        {
            *(check.check_leader.strip() for check in checks if check.check_leader.strip()),
            *(item.auditor.strip() for item in recommendations if item.auditor.strip()),
            *(item.manager.strip() for item in recommendations if item.manager.strip()),
        },
        key=lambda value: value.casefold(),
    )
    departments = sorted(
        {
            item.audit_object.strip()
            for item in recommendations
            if item.audit_object and item.audit_object.strip()
        },
        key=lambda value: value.casefold(),
    )
    anchor_dates = sorted({check.start_date.isoformat() for check in checks if check.start_date})
    # Keep calendar range used by UI for empty datasets / padding years.
    for year in (2025, 2026):
        iso = date(year, 1, 1).isoformat()
        if iso not in anchor_dates:
            anchor_dates.append(iso)
    anchor_dates = sorted(set(anchor_dates))
    return ChecksAnalyticsFilterOptions(
        auditors=auditors,
        departments=departments,
        anchor_dates=anchor_dates,
    )


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
    result = await session.execute(
        select(Check)
        .options(selectinload(Check.recommendations))
        .order_by(Check.start_date.desc(), Check.id.desc())
    )
    checks = list(result.scalars().unique().all())

    recommendations_result = await session.execute(select(Recommendation))
    recommendations = list(recommendations_result.scalars().all())

    filtered = _filter_checks(
        checks,
        auditors=auditors or [],
        departments=departments or [],
        years=years or [],
        quarters=quarters or [],
        months=months or [],
    )
    summary = _summarize(filtered)
    return ChecksAnalyticsResponse(
        universe_total=len(checks),
        filtered_total=len(filtered),
        granularity=granularity,
        summary=summary,
        completion_share=_completion_share(summary.total, summary.completed),
        period_series=_period_series(filtered, granularity),
        view_distribution=_view_distribution(filtered),
        type_distribution=_type_distribution(filtered),
        department_map=_department_map(filtered),
        effectiveness_matrix=_effectiveness_matrix(filtered),
        filter_options=_filter_options(checks, recommendations),
    )
