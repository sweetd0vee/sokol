from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.analytics import (
    ChecksAnalyticsFilterOptions,
    NamedCount,
    PeriodGranularity,
    RecommendationsAnalyticsResponse,
    RecommendationsSummary,
)
from app.services.analytics.constants import (
    ADDITIONAL_STATUS_COLORS,
    ADDITIONAL_STATUS_LABELS,
    INDICATOR_COLORS,
    INDICATOR_KEY_ALIASES,
    INDICATOR_LABELS,
    MATERIALITY_COLORS,
    MATERIALITY_LABELS,
    STATUS_COLORS,
    STATUS_LABELS,
)
from app.services.analytics.params import recommendation_params
from app.services.analytics.sql_aggregates import (
    collect_filter_option_departments_sql,
    collect_filter_option_recommendation_auditors_sql,
    collect_recommendation_anchor_dates_sql,
    count_recommendations,
    recommendation_check_links_sql,
    recommendation_indicator_distribution_sql,
    recommendation_materiality_matrix_sql,
    recommendation_object_distribution_sql,
    recommendation_period_series_sql,
    summarize_recommendations_sql,
)

__all__ = [
    "ADDITIONAL_STATUS_COLORS",
    "ADDITIONAL_STATUS_LABELS",
    "INDICATOR_COLORS",
    "INDICATOR_KEY_ALIASES",
    "INDICATOR_LABELS",
    "MATERIALITY_COLORS",
    "MATERIALITY_LABELS",
    "STATUS_COLORS",
    "STATUS_LABELS",
    "build_additional_status_distribution",
    "build_materiality_distribution",
    "build_recommendations_analytics",
    "build_status_distribution",
]


def _named_from_map(
    counts: dict[str, int],
    labels: dict[str, str],
    colors: dict[str, str] | None = None,
) -> list[NamedCount]:
    return [
        NamedCount(
            name=labels.get(key, key),
            value=value,
            color=(colors or {}).get(key),
        )
        for key, value in counts.items()
    ]


def build_status_distribution(summary: RecommendationsSummary) -> list[NamedCount]:
    return _named_from_map(
        {
            "completed": summary.by_status.completed,
            "unresolved": summary.by_status.unresolved,
            "on_control": summary.by_status.on_control,
            "in_progress": summary.by_status.in_progress,
        },
        STATUS_LABELS,
        STATUS_COLORS,
    )


def build_additional_status_distribution(summary: RecommendationsSummary) -> list[NamedCount]:
    return _named_from_map(
        {
            "on_time": summary.by_additional.on_time,
            "deadline_violated": summary.by_additional.deadline_violated,
            "on_control": summary.by_additional.on_control,
        },
        ADDITIONAL_STATUS_LABELS,
        ADDITIONAL_STATUS_COLORS,
    )


def build_materiality_distribution(summary: RecommendationsSummary) -> list[NamedCount]:
    return _named_from_map(
        {
            "низкий": summary.by_materiality.низкий,
            "средний": summary.by_materiality.средний,
            "высокий": summary.by_materiality.высокий,
        },
        MATERIALITY_LABELS,
        MATERIALITY_COLORS,
    )


async def build_recommendations_analytics(
    session: AsyncSession,
    *,
    granularity: PeriodGranularity = "year",
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    statuses: list[str] | None = None,
    additional_statuses: list[str] | None = None,
    materiality_levels: list[str] | None = None,
) -> RecommendationsAnalyticsResponse:
    filters = recommendation_params(
        years=years,
        quarters=quarters,
        months=months,
        auditors=auditors,
        departments=departments,
        statuses=statuses,
        additional_statuses=additional_statuses,
        materiality_levels=materiality_levels,
    )
    summary = await summarize_recommendations_sql(session, **filters)
    period_series = await recommendation_period_series_sql(session, granularity, **filters)
    return RecommendationsAnalyticsResponse(
        universe_total=await count_recommendations(session, filtered=False),
        filtered_total=summary.total,
        granularity=granularity,
        summary=summary,
        period_series=period_series,
        materiality_distribution=build_materiality_distribution(summary),
        indicator_distribution=await recommendation_indicator_distribution_sql(session, **filters),
        check_links=await recommendation_check_links_sql(session, **filters),
        materiality_matrix=await recommendation_materiality_matrix_sql(session, **filters),
        object_distribution=await recommendation_object_distribution_sql(session, **filters),
        status_distribution=build_status_distribution(summary),
        additional_status_distribution=build_additional_status_distribution(summary),
        filter_options=ChecksAnalyticsFilterOptions(
            auditors=await collect_filter_option_recommendation_auditors_sql(session),
            departments=await collect_filter_option_departments_sql(session),
            anchor_dates=await collect_recommendation_anchor_dates_sql(session),
        ),
    )
