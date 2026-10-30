"""Audit-object parsing and department matching for analytics."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.models.departments import Department
from app.models.recommendations import Recommendation
from app.schemas.analytics import NamedCount
from app.services.analytics.constants import WITHOUT_DEPARTMENT
from app.services.analytics.values import named_counts
from app.utils.dictionary_text import (
    dictionary_match_key,
    find_dictionary_label_match,
    split_audit_object_values,
)


def parse_audit_object_parts(audit_object: str | list[str] | None) -> list[str]:
    parts = split_audit_object_values(audit_object)
    if parts:
        return parts
    if isinstance(audit_object, str) and audit_object.strip():
        return [audit_object.strip()]
    return []


def matches_any_audit_object_part(
    audit_object: str | list[str] | None,
    department_set: set[str],
) -> bool:
    return any(part in department_set for part in parse_audit_object_parts(audit_object))


def build_department_lookup(departments: list[str]) -> dict[str, str]:
    return {dictionary_match_key(name): name for name in departments}


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


def matched_departments_or_fallback(
    audit_object: str | list[str] | None,
    department_lookup: dict[str, str],
    *,
    fallback: str = WITHOUT_DEPARTMENT,
) -> set[str]:
    return match_audit_object_to_departments(audit_object, department_lookup) or {fallback}


def count_unique_labels_per_group(
    groups: Iterable[Iterable[str]],
    *,
    selected: set[str] | None = None,
    empty_label: str = WITHOUT_DEPARTMENT,
) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for departments in groups:
        dept_set = set(departments)
        visible = dept_set & selected if selected else dept_set
        if selected and not visible:
            continue
        if not visible:
            counts[empty_label] += 1
            continue
        for department in visible:
            counts[department] += 1
    return counts


def check_department_distribution(
    checks: list[Check],
    recommendations: list[Recommendation],
) -> dict[str, int]:
    by_serial: dict[str, list[Recommendation]] = defaultdict(list)
    for item in recommendations:
        serial = (item.serial_number or "").strip()
        if serial:
            by_serial[serial].append(item)

    groups: list[set[str]] = []
    for check in checks:
        linked = by_serial.get(check.serial_number, [])
        groups.append(
            {
                part
                for item in linked
                for part in parse_audit_object_parts(item.audit_object)
            }
        )
    return count_unique_labels_per_group(groups)


def check_canonical_department_distribution(
    checks: list[Check],
    recommendations: list[Recommendation],
    all_departments: list[str],
) -> dict[str, int]:
    rec_links = [
        ((item.serial_number or "").strip(), item.audit_object or "")
        for item in recommendations
    ]
    return check_canonical_department_distribution_from_links(
        [check.serial_number for check in checks],
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
        departments: set[str] = set()
        for audit_object in by_serial.get(serial_key, []):
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
        counts[WITHOUT_DEPARTMENT] = without_department
    return counts


def department_map_from_pairs(
    pairs: list[tuple[int, str | list[str]]],
    *,
    selected_departments: list[str] | None = None,
) -> list[NamedCount]:
    selected = {item.strip() for item in (selected_departments or []) if item.strip()}
    by_check: dict[int, set[str]] = defaultdict(set)
    for check_id, audit_object in pairs:
        by_check[check_id].update(parse_audit_object_parts(audit_object))
    return named_counts(
        count_unique_labels_per_group(
            by_check.values(),
            selected=selected or None,
        )
    )


async def load_department_names(session: AsyncSession) -> list[str]:
    result = await session.execute(select(Department.name).order_by(Department.name.asc()))
    names = list(result.scalars().all())
    if names:
        return names
    from app.db.catalogs.departments import DEPARTMENTS

    return sorted(DEPARTMENTS, key=lambda value: value.casefold())
