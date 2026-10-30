"""Shared analytics helpers used by tests, migrations, and seed import."""

from __future__ import annotations

from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.services.analytics.departments import (
    build_department_lookup,
    check_canonical_department_distribution,
    check_canonical_department_distribution_from_links,
    check_department_distribution,
    load_department_names,
    match_audit_object_to_departments,
    matches_any_audit_object_part,
    parse_audit_object_parts,
)
from app.services.analytics.values import completion_share, named_counts, pad_anchor_dates

__all__ = [
    "build_department_lookup",
    "check_canonical_department_distribution",
    "check_canonical_department_distribution_from_links",
    "check_department_distribution",
    "collect_analytics_auditors",
    "completion_share",
    "load_department_names",
    "match_audit_object_to_departments",
    "matches_any_audit_object_part",
    "named_counts",
    "pad_anchor_dates",
    "parse_audit_object_parts",
]


def collect_analytics_auditors(checks: list[Check], recommendations: list[Recommendation]) -> list[str]:
    return sorted(
        {
            *(check.check_leader.strip() for check in checks if check.check_leader.strip()),
            *(item.auditor.strip() for item in recommendations if item.auditor.strip()),
        },
        key=lambda value: value.casefold(),
    )
