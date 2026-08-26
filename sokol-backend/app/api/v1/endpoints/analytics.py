from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.analytics_deps import (
    AudiencePeriodFilters,
    PlanningFilters,
    RecommendationFilters,
    audience_period_filters,
    planning_filters,
    recommendation_filters,
)
from app.db.session import get_db_session
from app.schemas.analytics import (
    ChecksAnalyticsResponse,
    DvaAnalyticsResponse,
    MonitoringAnalyticsResponse,
    PlanningAnalyticsResponse,
    RecommendationsAnalyticsResponse,
)
from app.services.analytics.checks_analytics import build_checks_analytics
from app.services.analytics.dva_analytics import build_dva_analytics
from app.services.analytics.planning_analytics import build_planning_analytics
from app.services.analytics.recommendations_analytics import build_recommendations_analytics
from app.services.analytics.sql_aggregates import recommendation_status_matrix_sql

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/checks", response_model=ChecksAnalyticsResponse)
async def get_checks_analytics(
    filters: AudiencePeriodFilters = Depends(audience_period_filters),
    session: AsyncSession = Depends(get_db_session),
) -> ChecksAnalyticsResponse:
    return await build_checks_analytics(
        session,
        granularity=filters.granularity,
        years=filters.years,
        quarters=filters.quarters,
        months=filters.months,
        auditors=filters.auditors,
        departments=filters.departments,
    )


@router.get("/recommendations", response_model=RecommendationsAnalyticsResponse)
async def get_recommendations_analytics(
    filters: RecommendationFilters = Depends(recommendation_filters),
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationsAnalyticsResponse:
    return await build_recommendations_analytics(
        session,
        granularity=filters.granularity,
        years=filters.years,
        quarters=filters.quarters,
        months=filters.months,
        auditors=filters.auditors,
        departments=filters.departments,
        statuses=filters.statuses,
        additional_statuses=filters.additional_statuses,
        materiality_levels=filters.materiality_levels,
    )


@router.get("/monitoring", response_model=MonitoringAnalyticsResponse)
async def get_monitoring_analytics(
    filters: RecommendationFilters = Depends(recommendation_filters),
    session: AsyncSession = Depends(get_db_session),
) -> MonitoringAnalyticsResponse:
    full = await build_recommendations_analytics(
        session,
        granularity=filters.granularity,
        years=filters.years,
        quarters=filters.quarters,
        months=filters.months,
        auditors=filters.auditors,
        departments=filters.departments,
        statuses=filters.statuses,
        additional_statuses=filters.additional_statuses,
        materiality_levels=filters.materiality_levels,
    )
    recommendation_filters = {
        "years": filters.years,
        "quarters": filters.quarters,
        "months": filters.months,
        "auditors": filters.auditors,
        "departments": filters.departments,
        "statuses": filters.statuses,
        "additional_statuses": filters.additional_statuses,
        "materiality_levels": filters.materiality_levels,
    }
    return MonitoringAnalyticsResponse(
        universe_total=full.universe_total,
        filtered_total=full.filtered_total,
        granularity=full.granularity,
        summary=full.summary,
        period_series=full.period_series,
        status_distribution=full.status_distribution,
        additional_status_distribution=full.additional_status_distribution,
        indicator_distribution=full.indicator_distribution,
        status_matrix=await recommendation_status_matrix_sql(session, **recommendation_filters),
        filter_options=full.filter_options,
    )


@router.get("/dva", response_model=DvaAnalyticsResponse)
async def get_dva_analytics(
    filters: AudiencePeriodFilters = Depends(audience_period_filters),
    session: AsyncSession = Depends(get_db_session),
) -> DvaAnalyticsResponse:
    return await build_dva_analytics(
        session,
        granularity=filters.granularity,
        years=filters.years,
        quarters=filters.quarters,
        months=filters.months,
        auditors=filters.auditors,
        departments=filters.departments,
    )


@router.get("/planning", response_model=PlanningAnalyticsResponse)
async def get_planning_analytics(
    filters: PlanningFilters = Depends(planning_filters),
    session: AsyncSession = Depends(get_db_session),
) -> PlanningAnalyticsResponse:
    return await build_planning_analytics(
        session,
        granularity=filters.granularity,
        years=filters.years,
        quarters=filters.quarters,
        months=filters.months,
        departments=filters.departments,
    )
