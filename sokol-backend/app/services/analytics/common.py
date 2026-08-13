from __future__ import annotations

import re
from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.checks import Check, CheckStatus
from app.models.departments import Department
from app.models.recommendations import Recommendation
from app.schemas.analytics import ChecksSummary, NamedCount
from app.services.analytics.period import is_date_in_any_selected_periods
from app.utils.dictionary_text import dictionary_match_key, find_dictionary_label_match


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


def _matches_any_audit_object_part(audit_object: str | list[str] | None, department_set: set[str]) -> bool:
    return any(part in department_set for part in parse_audit_object_parts(audit_object))


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
            if not any(
                _matches_any_audit_object_part(item.audit_object, department_set)
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
        if department_set and not _matches_any_audit_object_part(item.audit_object, department_set):
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
            part
            for item in recommendations
            for part in parse_audit_object_parts(item.audit_object)
        },
        key=lambda value: value.casefold(),
    )


async def load_department_names(session: AsyncSession) -> list[str]:
    result = await session.execute(select(Department.name).order_by(Department.name.asc()))
    names = list(result.scalars().all())
    if names:
        return names
    from app.db.department_names import DEPARTMENTS

    return sorted(DEPARTMENTS, key=lambda value: value.casefold())


def build_department_lookup(departments: list[str]) -> dict[str, str]:
    return {dictionary_match_key(name): name for name in departments}


def parse_audit_object_parts(audit_object: str | list[str] | None) -> list[str]:
    if isinstance(audit_object, list):
        parts: list[str] = []
        for item in audit_object:
            parts.extend(parse_audit_object_parts(item))
        return parts

    raw = (audit_object or "").strip()
    if not raw:
        return []
    parts = [part.strip() for part in re.split(r"[;,]", raw) if part.strip()]
    return parts or [raw]


def match_audit_object_to_departments(
    audit_object: str | list[str] | None,
    department_by_normalized: dict[str, str],
) -> set[str]:
    matched: set[str] = set()
    candidates = list(dict.fromkeys(department_by_normalized.values()))
    for part in parse_audit_object_parts(audit_object):
        canonical = department_by_normalized.get(dictionary_match_key(part))
        if canonical is None:
            canonical = find_dictionary_label_match(part, candidates)
        if canonical:
            matched.add(canonical)
    return matched


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
            part
            for item in linked
            for part in parse_audit_object_parts(item.audit_object)
        }
        if not departments:
            counts["Без департамента"] += 1
            continue
        for department in departments:
            counts[department] += 1
    return counts


def check_canonical_department_distribution(
    checks: list[Check],
    recommendations: list[Recommendation],
    all_departments: list[str],
) -> dict[str, int]:
    check_serials = [check.serial_number for check in checks]
    rec_links = [
        ((item.serial_number or "").strip(), item.audit_object or "")
        for item in recommendations
    ]
    return check_canonical_department_distribution_from_links(
        check_serials,
        rec_links,
        all_departments,
    )


def check_canonical_department_distribution_from_links(
    check_serials: list[str],
    recommendation_links: list[tuple[str, str | list[str]]],
    all_departments: list[str],
) -> dict[str, int]:
    department_by_normalized = build_department_lookup(all_departments)
    by_serial: dict[str, list[str]] = defaultdict(list)
    for serial, audit_object in recommendation_links:
        if serial:
            by_serial[serial].append(audit_object)

    counts: dict[str, int] = {name: 0 for name in all_departments}
    without_department = 0
    for serial in check_serials:
        serial_key = (serial or "").strip()
        linked = by_serial.get(serial_key, [])
        departments: set[str] = set()
        for audit_object in linked:
            departments |= match_audit_object_to_departments(
                audit_object,
                department_by_normalized,
            )
        if not departments:
            without_department += 1
            continue
        for department in departments:
            counts[department] += 1
    if without_department:
        counts["Без департамента"] = without_department
    return counts


def check_department_map(checks: list[Check]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for check in checks:
        departments = {
            part
            for item in (check.recommendations or [])
            for part in parse_audit_object_parts(item.audit_object)
        }
        if not departments:
            counts["Без департамента"] += 1
            continue
        for department in departments:
            counts[department] += 1
    return named_counts(counts)
