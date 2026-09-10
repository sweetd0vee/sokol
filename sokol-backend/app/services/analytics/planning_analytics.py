from __future__ import annotations

from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recommendations import RecommendationStatus
from app.schemas.analytics import (
    DvaCheckCountRef,
    NamedCount,
    PeriodGranularity,
    PlanningAnalyticsFilterOptions,
    PlanningAnalyticsResponse,
    PlanningCoverage,
    PlanningCoverageDonutSlice,
    PlanningHighMaterialityDepartmentRow,
    PlanningUnresolvedDepartmentRow,
)
from app.services.analytics.constants import (
    PLANNING_TOP_DEPARTMENTS,
    UNSPECIFIED,
    WITHOUT_DEPARTMENT,
)
from app.services.analytics.departments import (
    build_department_lookup,
    check_canonical_department_distribution_from_links,
    load_department_names,
    matched_departments_or_fallback,
)
from app.services.analytics.params import check_params
from app.services.analytics.sql_aggregates import (
    collect_combined_anchor_dates_sql,
    count_checks,
    count_recommendations,
    load_check_serial_numbers,
    load_planning_recommendation_rows,
)

_COVERAGE_SKIP = {UNSPECIFIED, WITHOUT_DEPARTMENT, ""}
_UNRESOLVED_STATUS = RecommendationStatus.UNRESOLVED.value


def _coverage_universe(all_departments: list[str]) -> list[str]:
    return sorted(
        {
            name.strip()
            for name in all_departments
            if name and name.strip() not in _COVERAGE_SKIP
        },
        key=lambda value: value.casefold(),
    )


def _build_coverage(
    all_departments: list[str],
    check_counts: dict[str, int],
) -> PlanningCoverage:
    universe = _coverage_universe(all_departments)
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


def _unresolved_by_department(
    rows: list[tuple[str, str | list[str], str, str]],
    department_lookup: dict[str, str],
    *,
    selected_departments: list[str] | None = None,
) -> list[PlanningUnresolvedDepartmentRow]:
    selected = {name.strip() for name in (selected_departments or []) if name.strip()}
    counts: dict[str, int] = defaultdict(int)
    checks: dict[str, dict[str, DvaCheckCountRef]] = defaultdict(dict)
    for serial, audit_object, status, short_name in rows:
        if status != _UNRESOLVED_STATUS:
            continue
        serial_key = (serial or "").strip()
        display_short = (short_name or "").strip()
        for name in matched_departments_or_fallback(audit_object, department_lookup):
            if name in _COVERAGE_SKIP:
                continue
            if selected and name not in selected:
                continue
            counts[name] += 1
            if not serial_key:
                continue
            existing = checks[name].get(serial_key)
            if existing is None:
                checks[name][serial_key] = DvaCheckCountRef(
                    key=serial_key,
                    short_name=display_short,
                    count=1,
                )
                continue
            checks[name][serial_key] = DvaCheckCountRef(
                key=existing.key,
                short_name=existing.short_name or display_short,
                count=existing.count + 1,
            )
    ranking = [
        PlanningUnresolvedDepartmentRow(
            name=name,
            value=value,
            checks=sorted(checks.get(name, {}).values(), key=lambda item: (-item.count, item.key)),
        )
        for name, value in counts.items()
        if value > 0
    ]
    return sorted(ranking, key=lambda row: (-row.value, row.name.casefold()))


def _high_materiality_by_department(
    rows: list[tuple[str, str | list[str], str, str, str]],
    department_lookup: dict[str, str],
    *,
    selected_departments: list[str] | None = None,
) -> tuple[list[PlanningHighMaterialityDepartmentRow], int]:
    selected = {name.strip() for name in (selected_departments or []) if name.strip()}
    totals: dict[str, int] = defaultdict(int)
    highs: dict[str, int] = defaultdict(int)
    checks: dict[str, dict[str, DvaCheckCountRef]] = defaultdict(dict)
    for serial, audit_object, materiality_level, _status, short_name in rows:
        serial_key = (serial or "").strip()
        display_short = (short_name or "").strip()
        is_high = materiality_level == "высокий"
        for name in matched_departments_or_fallback(audit_object, department_lookup):
            if name in _COVERAGE_SKIP:
                continue
            if selected and name not in selected:
                continue
            totals[name] += 1
            if not is_high:
                continue
            highs[name] += 1
            if not serial_key:
                continue
            existing = checks[name].get(serial_key)
            if existing is None:
                checks[name][serial_key] = DvaCheckCountRef(
                    key=serial_key,
                    short_name=display_short,
                    count=1,
                )
                continue
            checks[name][serial_key] = DvaCheckCountRef(
                key=existing.key,
                short_name=existing.short_name or display_short,
                count=existing.count + 1,
            )
    ranking = [
        PlanningHighMaterialityDepartmentRow(
            name=name,
            value=value,
            total=totals.get(name, value),
            checks=sorted(checks.get(name, {}).values(), key=lambda item: (-item.count, item.key)),
        )
        for name, value in highs.items()
        if value > 0
    ]
    ranking.sort(key=lambda row: (-row.value, row.name.casefold()))
    return ranking[:PLANNING_TOP_DEPARTMENTS], sum(highs.values())


async def build_planning_analytics(
    session: AsyncSession,
    *,
    granularity: PeriodGranularity = "year",
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    departments: list[str] | None = None,
) -> PlanningAnalyticsResponse:
    filters = check_params(
        years=years,
        quarters=quarters,
        months=months,
        departments=departments,
    )
    coverage_filters = check_params(
        years=years,
        quarters=quarters,
        months=months,
        departments=[],
    )
    all_departments = await load_department_names(session)
    department_lookup = build_department_lookup(all_departments)

    coverage_check_serials = await load_check_serial_numbers(session, **coverage_filters)
    coverage_recommendation_rows = await load_planning_recommendation_rows(session, **coverage_filters)
    if departments:
        unresolved_recommendation_rows = await load_planning_recommendation_rows(session, **filters)
        filtered_check_serials = await load_check_serial_numbers(session, **filters)
    else:
        unresolved_recommendation_rows = coverage_recommendation_rows
        filtered_check_serials = coverage_check_serials
    check_counts = {
        name: count
        for name, count in check_canonical_department_distribution_from_links(
            coverage_check_serials,
            [(serial, audit_object) for serial, audit_object, _materiality, _status, _short in coverage_recommendation_rows],
            all_departments,
        ).items()
        if name not in _COVERAGE_SKIP
    }
    coverage = _build_coverage(all_departments, check_counts)
    unresolved_ranking = _unresolved_by_department(
        [
            (serial, audit_object, status, short_name)
            for serial, audit_object, _materiality, status, short_name in unresolved_recommendation_rows
        ],
        department_lookup,
        selected_departments=departments,
    )
    high_ranking, high_total = _high_materiality_by_department(
        unresolved_recommendation_rows,
        department_lookup,
        selected_departments=departments,
    )

    return PlanningAnalyticsResponse(
        universe_checks_total=await count_checks(session, filtered=False),
        universe_recommendations_total=await count_recommendations(session, filtered=False),
        filtered_checks_total=len(filtered_check_serials),
        filtered_recommendations_total=len(unresolved_recommendation_rows),
        granularity=granularity,
        coverage=coverage,
        unresolved_by_department=unresolved_ranking,
        high_materiality_by_department=high_ranking,
        high_materiality_total=high_total,
        filter_options=PlanningAnalyticsFilterOptions(
            departments=all_departments,
            anchor_dates=await collect_combined_anchor_dates_sql(session),
        ),
    )
