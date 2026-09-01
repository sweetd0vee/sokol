"""In-memory analytics helpers kept in parity with SQL filters."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.checks import Check, CheckStatus
from app.models.recommendations import Recommendation
from app.schemas.analytics import ChecksSummary
from app.services.analytics.departments import (
    build_department_lookup,
    check_canonical_department_distribution,
    check_canonical_department_distribution_from_links,
    check_department_distribution,
    check_department_map,
    load_department_names,
    match_audit_object_to_departments,
    matches_any_audit_object_part,
    parse_audit_object_parts,
)
from app.services.analytics.period import is_date_in_any_selected_periods
from app.services.analytics.values import (
    completion_share,
    enum_str,
    named_counts,
    pad_anchor_dates,
    stripped_set,
)

__all__ = [
    "build_department_lookup",
    "check_canonical_department_distribution",
    "check_canonical_department_distribution_from_links",
    "check_department_distribution",
    "check_department_map",
    "collect_analytics_auditors",
    "collect_audit_objects",
    "collect_recommendation_auditors",
    "completion_share",
    "completion_share_from_checks",
    "filter_checks",
    "filter_recommendations",
    "load_checks_with_recommendations",
    "load_department_names",
    "load_recommendations",
    "match_audit_object_to_departments",
    "named_counts",
    "pad_anchor_dates",
    "parse_audit_object_parts",
    "summarize_checks",
]


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


def _check_matches_auditors(check: Check, auditor_set: set[str]) -> bool:
    linked = check.recommendations or []
    return check.check_leader in auditor_set or any(
        item.auditor in auditor_set or item.manager in auditor_set for item in linked
    )


def filter_checks(
    checks: list[Check],
    *,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> list[Check]:
    auditor_set = stripped_set(auditors)
    department_set = stripped_set(departments)
    years = years or []
    quarters = quarters or []
    months = months or []

    result: list[Check] = []
    for check in checks:
        if check.start_date is None:
            continue
        if auditor_set and not _check_matches_auditors(check, auditor_set):
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
            if not any(
                matches_any_audit_object_part(item.audit_object, department_set)
                for item in linked
            ):
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
    auditor_set = stripped_set(auditors)
    department_set = stripped_set(departments)
    status_set = stripped_set(statuses)
    additional_set = stripped_set(additional_statuses)
    materiality_set = stripped_set(materiality_levels)
    years = years or []
    quarters = quarters or []
    months = months or []

    result: list[Recommendation] = []
    for item in recommendations:
        if item.deadline is None:
            continue
        if auditor_set and item.auditor not in auditor_set:
            continue
        if department_set and not matches_any_audit_object_part(item.audit_object, department_set):
            continue
        if status_set and enum_str(item.status) not in status_set:
            continue
        if additional_set and enum_str(item.additional_status) not in additional_set:
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
            part
            for item in recommendations
            for part in parse_audit_object_parts(item.audit_object)
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


def completion_share_from_checks(checks: list[Check]) -> int:
    if not checks:
        return 0
    completed = sum(1 for check in checks if check.status == CheckStatus.COMPLETED)
    return completion_share(len(checks), completed)
