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
    build_department_lookup,
    check_canonical_department_distribution,
    filter_checks,
    filter_recommendations,
    load_checks_with_recommendations,
    load_department_names,
    load_recommendations,
    match_audit_object_to_departments,
    pad_anchor_dates,
)


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
    all_departments: list[str],
    department_lookup: dict[str, str],
) -> list[PlanningDepartmentAnalyticsRow]:
    check_by_dept = check_canonical_department_distribution(
        checks,
        all_recommendations_for_links,
        all_departments,
    )
    rec_by_dept: dict[str, int] = defaultdict(int)
    high_by_dept: dict[str, int] = defaultdict(int)
    for item in recommendations:
        matched = match_audit_object_to_departments(
            item.audit_object or "",
            department_lookup,
        )
        targets = matched or {"Без департамента"}
        for name in targets:
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
        if name != "Без департамента"
    ]
    return sorted(
        rows,
        key=lambda row: (-(row.checks + row.recommendations), row.name),
    )[:15]


def _high_materiality_by_department(
    recommendations: list[Recommendation],
    department_lookup: dict[str, str],
) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for item in recommendations:
        if item.materiality_level != "высокий":
            continue
        matched = match_audit_object_to_departments(
            item.audit_object or "",
            department_lookup,
        )
        targets = matched or {"Без департамента"}
        for name in targets:
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
    all_departments = await load_department_names(session)
    department_lookup = build_department_lookup(all_departments)

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
        for name, count in check_canonical_department_distribution(
            filtered_checks_for_coverage,
            recommendations,
            all_departments,
        ).items()
        if name != "Без департамента"
    }
    coverage = _build_coverage(all_departments, check_counts)
    high_ranking = _high_materiality_by_department(
        filtered_recommendations,
        department_lookup,
    )

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
            all_departments,
            department_lookup,
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
