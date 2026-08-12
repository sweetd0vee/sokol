from __future__ import annotations

from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.schemas.analytics import (
    NamedCount,
    PeriodGranularity,
    PlanningAnalyticsFilterOptions,
    PlanningAnalyticsResponse,
    PlanningCoverage,
    PlanningCoverageDonutSlice,
    PlanningDepartmentAnalyticsRow,
)
from app.services.analytics.common import (
    collect_audit_objects,
    filter_checks,
    filter_recommendations,
    load_checks_with_recommendations,
    load_recommendations,
    pad_anchor_dates,
)


def _check_department_distribution(
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


def _build_coverage(
    all_departments: list[str],
    check_counts: dict[str, int],
) -> PlanningCoverage:
    universe = sorted({name for name in all_departments if name}, key=lambda value: value.casefold())
    covered_list = [name for name in universe if check_counts.get(name, 0) > 0]
    uncovered_list = [name for name in universe if check_counts.get(name, 0) <= 0]
    covered = len(covered_list)
    uncovered = len(uncovered_list)
    total = len(universe)
    coverage_rate = round((covered / total) * 100) if total else 0
    uncovered_rate = round((uncovered / total) * 100) if total else 0
    donut = [
        PlanningCoverageDonutSlice(name="С охватом", value=covered, color="#22C55E"),
        PlanningCoverageDonutSlice(name="Без охвата", value=uncovered, color="#CBD5E1"),
    ]
    checks_by_department = sorted(
        [NamedCount(name=name, value=check_counts.get(name, 0)) for name in universe],
        key=lambda row: (row.value, row.name.casefold()),
    )
    return PlanningCoverage(
        covered=covered,
        uncovered=uncovered,
        total=total,
        coverage_rate=coverage_rate,
        uncovered_rate=uncovered_rate,
        covered_departments=covered_list,
        uncovered_departments=uncovered_list,
        donut=[slice_ for slice_ in donut if slice_.value > 0],
        checks_by_department=checks_by_department,
    )


def _department_analytics(
    checks: list[Check],
    recommendations: list[Recommendation],
    all_recommendations_for_links: list[Recommendation],
) -> list[PlanningDepartmentAnalyticsRow]:
    check_by_dept = _check_department_distribution(checks, all_recommendations_for_links)
    rec_by_dept: dict[str, int] = defaultdict(int)
    high_by_dept: dict[str, int] = defaultdict(int)
    for item in recommendations:
        name = (item.audit_object or "").strip() or "Без департамента"
        rec_by_dept[name] += 1
        if item.materiality_level == "высокий":
            high_by_dept[name] += 1

    names = set(check_by_dept) | set(rec_by_dept)
    rows = [
        PlanningDepartmentAnalyticsRow(
            name=name,
            checks=check_by_dept.get(name, 0),
            recommendations=rec_by_dept.get(name, 0),
            high_materiality=high_by_dept.get(name, 0),
        )
        for name in names
    ]
    return sorted(
        rows,
        key=lambda row: (-(row.checks + row.recommendations), row.name),
    )[:15]


def _high_materiality_by_department(recommendations: list[Recommendation]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for item in recommendations:
        if item.materiality_level != "высокий":
            continue
        name = (item.audit_object or "").strip() or "Без департамента"
        counts[name] += 1
    return [
        NamedCount(name=name, value=value)
        for name, value in sorted(counts.items(), key=lambda row: (-row[1], row[0]))[:15]
    ]


async def build_planning_analytics(
    session: AsyncSession,
    *,
    granularity: PeriodGranularity = "year",
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    departments: list[str] | None = None,
) -> PlanningAnalyticsResponse:
    checks = await load_checks_with_recommendations(session)
    recommendations = await load_recommendations(session)
    all_departments = collect_audit_objects(recommendations)

    filtered_checks = filter_checks(
        checks,
        departments=departments,
        years=years,
        quarters=quarters,
        months=months,
    )
    filtered_checks_for_coverage = filter_checks(
        checks,
        departments=[],
        years=years,
        quarters=quarters,
        months=months,
    )
    filtered_recommendations = filter_recommendations(
        recommendations,
        departments=departments,
        years=years,
        quarters=quarters,
        months=months,
    )

    check_counts = {
        name: count
        for name, count in _check_department_distribution(
            filtered_checks_for_coverage, recommendations
        ).items()
        if name != "Без департамента"
    }
    coverage = _build_coverage(all_departments, check_counts)
    high_ranking = _high_materiality_by_department(filtered_recommendations)

    return PlanningAnalyticsResponse(
        universe_checks_total=len(checks),
        universe_recommendations_total=len(recommendations),
        filtered_checks_total=len(filtered_checks),
        filtered_recommendations_total=len(filtered_recommendations),
        granularity=granularity,
        coverage=coverage,
        department_analytics=_department_analytics(
            filtered_checks,
            filtered_recommendations,
            recommendations,
        ),
        high_materiality_by_department=high_ranking,
        high_materiality_total=sum(item.value for item in high_ranking),
        filter_options=PlanningAnalyticsFilterOptions(
            departments=all_departments,
            anchor_dates=pad_anchor_dates(
                [check.start_date for check in checks if check.start_date]
                + [item.deadline for item in recommendations if item.deadline]
            ),
        ),
    )
