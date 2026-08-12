from __future__ import annotations

from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.checks import Check, CheckStatus
from app.models.recommendations import Recommendation
from app.schemas.analytics import ChecksSummary, NamedCount
from app.services.analytics.period import is_date_in_any_selected_periods


async def load_checks_with_recommendations(session: AsyncSession) -> list[Check]:
    result = await session.execute(
        select(Check)
        .options(selectinload(Check.recommendations))
        .order_by(Check.start_date.desc(), Check.id.desc())
    )
    return list(result.scalars().unique().all())


async def load_recommendations(session: AsyncSession) -> list[Recommendation]:
    result = await session.execute(select(Recommendation).order_by(Recommendation.id.desc()))
    return list(result.scalars().all())


def pad_anchor_dates(dates: list[date]) -> list[str]:
    iso_dates = {value.isoformat() for value in dates if value is not None}
    for year in (2025, 2026):
        iso_dates.add(date(year, 1, 1).isoformat())
    return sorted(iso_dates)


def filter_checks(
    checks: list[Check],
    *,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> list[Check]:
    auditor_set = {item.strip() for item in (auditors or []) if item.strip()}
    department_set = {item.strip() for item in (departments or []) if item.strip()}
    years = years or []
    quarters = quarters or []
    months = months or []

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


def filter_recommendations(
    recommendations: list[Recommendation],
    *,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    statuses: list[str] | None = None,
    additional_statuses: list[str] | None = None,
    materiality_levels: list[str] | None = None,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> list[Recommendation]:
    auditor_set = {item.strip() for item in (auditors or []) if item.strip()}
    department_set = {item.strip() for item in (departments or []) if item.strip()}
    status_set = {item.strip() for item in (statuses or []) if item.strip()}
    additional_set = {item.strip() for item in (additional_statuses or []) if item.strip()}
    materiality_set = {item.strip() for item in (materiality_levels or []) if item.strip()}
    years = years or []
    quarters = quarters or []
    months = months or []

    result: list[Recommendation] = []
    for item in recommendations:
        if item.deadline is None:
            continue
        if auditor_set and item.auditor not in auditor_set:
            continue
        if department_set and item.audit_object not in department_set:
            continue
        status_value = item.status.value if hasattr(item.status, "value") else str(item.status)
        additional_value = (
            item.additional_status.value
            if hasattr(item.additional_status, "value")
            else str(item.additional_status)
        )
        if status_set and status_value not in status_set:
            continue
        if additional_set and additional_value not in additional_set:
            continue
        if materiality_set and item.materiality_level not in materiality_set:
            continue
        if not is_date_in_any_selected_periods(
            item.deadline,
            years=years,
            quarters=quarters,
            months=months,
        ):
            continue
        result.append(item)
    return result


def collect_recommendation_auditors(recommendations: list[Recommendation]) -> list[str]:
    return sorted(
        {item.auditor.strip() for item in recommendations if item.auditor and item.auditor.strip()},
        key=lambda value: value.casefold(),
    )


def collect_analytics_auditors(checks: list[Check], recommendations: list[Recommendation]) -> list[str]:
    return sorted(
        {
            *(check.check_leader.strip() for check in checks if check.check_leader.strip()),
            *(item.auditor.strip() for item in recommendations if item.auditor.strip()),
            *(item.manager.strip() for item in recommendations if item.manager.strip()),
        },
        key=lambda value: value.casefold(),
    )


def collect_audit_objects(recommendations: list[Recommendation]) -> list[str]:
    return sorted(
        {
            item.audit_object.strip()
            for item in recommendations
            if item.audit_object and item.audit_object.strip()
        },
        key=lambda value: value.casefold(),
    )


def summarize_checks(checks: list[Check]) -> ChecksSummary:
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


def completion_share(total: int, completed: int) -> int:
    if total <= 0:
        return 0
    return round((completed / total) * 100)


def completion_share_from_checks(checks: list[Check]) -> int:
    if not checks:
        return 0
    completed = sum(1 for check in checks if check.status == CheckStatus.COMPLETED)
    return completion_share(len(checks), completed)


def named_counts(counts: dict[str, int], *, positive_only: bool = False) -> list[NamedCount]:
    items = counts.items()
    if positive_only:
        items = ((name, value) for name, value in items if value > 0)
    return [
        NamedCount(name=name, value=value)
        for name, value in sorted(items, key=lambda row: (-row[1], row[0]))
    ]


def check_department_distribution(
    checks: list[Check],
    recommendations: list[Recommendation],
) -> dict[str, int]:
    by_serial: dict[str, list[Recommendation]] = defaultdict(list)
    for item in recommendations:
        serial = (item.serial_number or "").strip()
        if serial:
            by_serial[serial].append(item)

    counts: dict[str, int] = defaultdict(int)
    for check in checks:
        linked = by_serial.get(check.serial_number, [])
        departments = {
            (item.audit_object or "").strip()
            for item in linked
            if item.audit_object and item.audit_object.strip()
        }
        if not departments:
            counts["Без департамента"] += 1
            continue
        for department in departments:
            counts[department] += 1
    return counts


def check_department_map(checks: list[Check]) -> list[NamedCount]:
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
    return named_counts(counts)
