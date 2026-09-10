from collections.abc import Awaitable, Callable
from dataclasses import asdict
from typing import Any

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
from app.services.analytics.recommendations_analytics import (
    build_monitoring_analytics,
    build_recommendations_analytics,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


async def _build(
    builder: Callable[..., Awaitable[Any]],
    filters: object,
    session: AsyncSession,
) -> Any:
    return await builder(session, **asdict(filters))


@router.get("/checks", response_model=ChecksAnalyticsResponse)
async def get_checks_analytics(
    filters: AudiencePeriodFilters = Depends(audience_period_filters),
    session: AsyncSession = Depends(get_db_session),
) -> ChecksAnalyticsResponse:
    return await _build(build_checks_analytics, filters, session)


@router.get("/recommendations", response_model=RecommendationsAnalyticsResponse)
async def get_recommendations_analytics(
    filters: RecommendationFilters = Depends(recommendation_filters),
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationsAnalyticsResponse:
    return await _build(build_recommendations_analytics, filters, session)


@router.get("/monitoring", response_model=MonitoringAnalyticsResponse)
async def get_monitoring_analytics(
    filters: RecommendationFilters = Depends(recommendation_filters),
    session: AsyncSession = Depends(get_db_session),
) -> MonitoringAnalyticsResponse:
    return await _build(build_monitoring_analytics, filters, session)


@router.get("/dva", response_model=DvaAnalyticsResponse)
async def get_dva_analytics(
    filters: AudiencePeriodFilters = Depends(audience_period_filters),
    session: AsyncSession = Depends(get_db_session),
) -> DvaAnalyticsResponse:
    return await _build(build_dva_analytics, filters, session)


@router.get("/planning", response_model=PlanningAnalyticsResponse)
async def get_planning_analytics(
    filters: PlanningFilters = Depends(planning_filters),
    session: AsyncSession = Depends(get_db_session),
) -> PlanningAnalyticsResponse:
    return await _build(build_planning_analytics, filters, session)
