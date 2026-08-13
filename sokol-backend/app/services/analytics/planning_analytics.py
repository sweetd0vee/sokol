from __future__ import annotations

from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

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
    check_canonical_department_distribution_from_links,
    load_department_names,
    match_audit_object_to_departments,
)
from app.services.analytics.sql_aggregates import (
    collect_combined_anchor_dates_sql,
    count_checks,
    count_recommendations,
    load_check_serial_numbers,
    load_recommendation_department_rows,
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
    check_serials: list[str],
    recommendation_rows: list[tuple[str, str | list[str], str]],
    all_recommendation_links: list[tuple[str, str | list[str], str]],
    all_departments: list[str],
    department_lookup: dict[str, str],
) -> list[PlanningDepartmentAnalyticsRow]:
    check_by_dept = check_canonical_department_distribution_from_links(
        check_serials,
        [(serial, audit_object) for serial, audit_object, _materiality in all_recommendation_links],
        all_departments,
    )
    rec_by_dept: dict[str, int] = defaultdict(int)
    high_by_dept: dict[str, int] = defaultdict(int)
    for _serial, audit_object, materiality_level in recommendation_rows:
        matched = match_audit_object_to_departments(audit_object, department_lookup)
        targets = matched or {"Без департамента"}
        for name in targets:
            rec_by_dept[name] += 1
            if materiality_level == "высокий":
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
    recommendation_rows: list[tuple[str, str | list[str], str]],
    department_lookup: dict[str, str],
) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for _serial, audit_object, materiality_level in recommendation_rows:
        if materiality_level != "высокий":
            continue
        matched = match_audit_object_to_departments(audit_object, department_lookup)
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
    filters = {
        "years": years,
        "quarters": quarters,
        "months": months,
        "departments": departments,
    }
    coverage_filters = {
        "years": years,
        "quarters": quarters,
        "months": months,
        "departments": [],
    }
    all_departments = await load_department_names(session)
    department_lookup = build_department_lookup(all_departments)

    filtered_check_serials = await load_check_serial_numbers(session, **filters)
    coverage_check_serials = await load_check_serial_numbers(session, **coverage_filters)
    filtered_recommendation_rows = await load_recommendation_department_rows(session, **filters)
    all_recommendation_rows = await load_recommendation_department_rows(session)

    check_counts = {
        name: count
        for name, count in check_canonical_department_distribution_from_links(
            coverage_check_serials,
            [(serial, audit_object) for serial, audit_object, _materiality in all_recommendation_rows],
            all_departments,
        ).items()
        if name != "Без департамента"
    }
    coverage = _build_coverage(all_departments, check_counts)
    high_ranking = _high_materiality_by_department(filtered_recommendation_rows, department_lookup)

    return PlanningAnalyticsResponse(
        universe_checks_total=await count_checks(session, filtered=False),
        universe_recommendations_total=await count_recommendations(session, filtered=False),
        filtered_checks_total=len(filtered_check_serials),
        filtered_recommendations_total=len(filtered_recommendation_rows),
        granularity=granularity,
        coverage=coverage,
        department_analytics=_department_analytics(
            filtered_check_serials,
            filtered_recommendation_rows,
            all_recommendation_rows,
            all_departments,
            department_lookup,
        ),
        high_materiality_by_department=high_ranking,
        high_materiality_total=sum(item.value for item in high_ranking),
        filter_options=PlanningAnalyticsFilterOptions(
            departments=all_departments,
            anchor_dates=await collect_combined_anchor_dates_sql(session),
        ),
    )
