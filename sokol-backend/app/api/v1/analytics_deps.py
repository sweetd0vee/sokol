"""Shared query-parameter dependencies for analytics endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import Query

PeriodGranularity = Literal["year", "quarter", "month"]


@dataclass(frozen=True)
class PeriodFilters:
    granularity: PeriodGranularity
    years: list[str]
    quarters: list[str]
    months: list[str]


@dataclass(frozen=True)
class AudiencePeriodFilters(PeriodFilters):
    auditors: list[str]
    departments: list[str]


@dataclass(frozen=True)
class RecommendationFilters(AudiencePeriodFilters):
    statuses: list[str]
    additional_statuses: list[str]
    materiality_levels: list[str]


@dataclass(frozen=True)
class PlanningFilters(PeriodFilters):
    departments: list[str]


def planning_filters(
    granularity: PeriodGranularity = Query("year"),
    years: list[str] = Query(default=[]),
    quarters: list[str] = Query(default=[]),
    months: list[str] = Query(default=[]),
    departments: list[str] = Query(default=[]),
) -> PlanningFilters:
    return PlanningFilters(
        granularity=granularity,
        years=years,
        quarters=quarters,
        months=months,
        departments=departments,
    )


def audience_period_filters(
    granularity: PeriodGranularity = Query("year"),
    years: list[str] = Query(default=[]),
    quarters: list[str] = Query(default=[]),
    months: list[str] = Query(default=[]),
    auditors: list[str] = Query(default=[]),
    departments: list[str] = Query(default=[]),
) -> AudiencePeriodFilters:
    return AudiencePeriodFilters(
        granularity=granularity,
        years=years,
        quarters=quarters,
        months=months,
        auditors=auditors,
        departments=departments,
    )


def recommendation_filters(
    granularity: PeriodGranularity = Query("year"),
    years: list[str] = Query(default=[]),
    quarters: list[str] = Query(default=[]),
    months: list[str] = Query(default=[]),
    auditors: list[str] = Query(default=[]),
    departments: list[str] = Query(default=[]),
    statuses: list[str] = Query(default=[]),
    additional_statuses: list[str] = Query(default=[], alias="additionalStatuses"),
    materiality_levels: list[str] = Query(default=[], alias="materialityLevels"),
) -> RecommendationFilters:
    return RecommendationFilters(
        granularity=granularity,
        years=years,
        quarters=quarters,
        months=months,
        auditors=auditors,
        departments=departments,
        statuses=statuses,
        additional_statuses=additional_statuses,
        materiality_levels=materiality_levels,
    )
