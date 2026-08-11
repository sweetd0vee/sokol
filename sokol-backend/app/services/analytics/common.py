from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.checks import Check
from app.models.recommendations import Recommendation
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
