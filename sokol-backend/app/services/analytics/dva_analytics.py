from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.analytics import (
    ChecksAnalyticsFilterOptions,
    DvaAnalyticsResponse,
    PeriodGranularity,
)
from app.services.analytics.sql_aggregates import (
    collect_combined_anchor_dates_sql,
    collect_filter_option_auditors_sql,
    collect_filter_option_departments_sql,
    completion_share_from_summary,
    count_checks,
    count_recommendations,
    dva_auditor_load_sql,
    dva_auditor_matrix_sql,
    dva_document_readiness_sql,
    dva_portfolio_series_sql,
    grouped_named_counts_sql,
    recommendation_object_distribution_sql,
    summarize_checks_sql,
    summarize_recommendations_sql,
)
from app.services.analytics.sql_filters import check_filter_conditions, recommendation_filter_conditions
from app.models.checks import Check
from app.models.recommendations import Recommendation


async def build_dva_analytics(
    session: AsyncSession,
    *,
    granularity: PeriodGranularity = "year",
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
) -> DvaAnalyticsResponse:
    check_filters = {
        "years": years,
        "quarters": quarters,
        "months": months,
        "auditors": auditors,
        "departments": departments,
    }
    recommendation_filters = dict(check_filters)
    check_summary = await summarize_checks_sql(session, **check_filters)
    rec_summary = await summarize_recommendations_sql(session, **recommendation_filters)
    auditor_checks = await grouped_named_counts_sql(
        session,
        model=Check,
        column=Check.check_leader,
        filters=check_filter_conditions(**check_filters),
        positive_only=True,
    )
    auditor_recommendations = await grouped_named_counts_sql(
        session,
        model=Recommendation,
        column=Recommendation.auditor,
        filters=recommendation_filter_conditions(**recommendation_filters),
        positive_only=True,
    )
    return DvaAnalyticsResponse(
        universe_checks_total=await count_checks(session, filtered=False),
        universe_recommendations_total=await count_recommendations(session, filtered=False),
        filtered_checks_total=check_summary.total,
        filtered_recommendations_total=rec_summary.total,
        granularity=granularity,
        check_summary=check_summary,
        recommendation_summary=rec_summary,
        completion_share=completion_share_from_summary(check_summary),
        portfolio_series=await dva_portfolio_series_sql(
            session,
            granularity,
            check_filters=check_filters,
            recommendation_filters=recommendation_filters,
        ),
        auditor_load=await dva_auditor_load_sql(
            session,
            check_filters=check_filters,
            recommendation_filters=recommendation_filters,
        ),
        auditor_matrix=await dva_auditor_matrix_sql(
            session,
            granularity,
            check_filters=check_filters,
            recommendation_filters=recommendation_filters,
        ),
        document_readiness=await dva_document_readiness_sql(session, **check_filters),
        auditor_checks_treemap=auditor_checks,
        auditor_recommendations_treemap=auditor_recommendations,
        department_map=await recommendation_object_distribution_sql(session, **recommendation_filters),
        filter_options=ChecksAnalyticsFilterOptions(
            auditors=await collect_filter_option_auditors_sql(session),
            departments=await collect_filter_option_departments_sql(session),
            anchor_dates=await collect_combined_anchor_dates_sql(session),
        ),
    )
