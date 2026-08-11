from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

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

router = APIRouter(prefix="/analytics", tags=["analytics"])

PeriodGranularity = Literal["year", "quarter", "month"]


@router.get("/checks", response_model=ChecksAnalyticsResponse)
async def get_checks_analytics(
    granularity: PeriodGranularity = Query("year"),
    years: list[str] = Query(default=[]),
    quarters: list[str] = Query(default=[]),
    months: list[str] = Query(default=[]),
    auditors: list[str] = Query(default=[]),
    departments: list[str] = Query(default=[]),
    session: AsyncSession = Depends(get_db_session),
) -> ChecksAnalyticsResponse:
    return await build_checks_analytics(
        session,
        granularity=granularity,
        years=years,
        quarters=quarters,
        months=months,
        auditors=auditors,
        departments=departments,
    )


@router.get("/recommendations", response_model=RecommendationsAnalyticsResponse)
async def get_recommendations_analytics(
    granularity: PeriodGranularity = Query("year"),
    years: list[str] = Query(default=[]),
    quarters: list[str] = Query(default=[]),
    months: list[str] = Query(default=[]),
    auditors: list[str] = Query(default=[]),
    departments: list[str] = Query(default=[]),
    statuses: list[str] = Query(default=[]),
    additional_statuses: list[str] = Query(default=[], alias="additionalStatuses"),
    materiality_levels: list[str] = Query(default=[], alias="materialityLevels"),
    session: AsyncSession = Depends(get_db_session),
) -> RecommendationsAnalyticsResponse:
    return await build_recommendations_analytics(
        session,
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


@router.get("/monitoring", response_model=MonitoringAnalyticsResponse)
async def get_monitoring_analytics(
    granularity: PeriodGranularity = Query("year"),
    years: list[str] = Query(default=[]),
    quarters: list[str] = Query(default=[]),
    months: list[str] = Query(default=[]),
    auditors: list[str] = Query(default=[]),
    departments: list[str] = Query(default=[]),
    statuses: list[str] = Query(default=[]),
    additional_statuses: list[str] = Query(default=[], alias="additionalStatuses"),
    materiality_levels: list[str] = Query(default=[], alias="materialityLevels"),
    session: AsyncSession = Depends(get_db_session),
) -> MonitoringAnalyticsResponse:
    full = await build_recommendations_analytics(
        session,
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
    return MonitoringAnalyticsResponse(
        universe_total=full.universe_total,
        filtered_total=full.filtered_total,
        granularity=full.granularity,
        summary=full.summary,
        period_series=full.period_series,
        status_distribution=full.status_distribution,
        additional_status_distribution=full.additional_status_distribution,
        filter_options=full.filter_options,
    )


@router.get("/dva", response_model=DvaAnalyticsResponse)
async def get_dva_analytics(
    granularity: PeriodGranularity = Query("year"),
    years: list[str] = Query(default=[]),
    quarters: list[str] = Query(default=[]),
    months: list[str] = Query(default=[]),
    auditors: list[str] = Query(default=[]),
    departments: list[str] = Query(default=[]),
    session: AsyncSession = Depends(get_db_session),
) -> DvaAnalyticsResponse:
    return await build_dva_analytics(
        session,
        granularity=granularity,
        years=years,
        quarters=quarters,
        months=months,
        auditors=auditors,
        departments=departments,
    )


@router.get("/planning", response_model=PlanningAnalyticsResponse)
async def get_planning_analytics(
    granularity: PeriodGranularity = Query("year"),
    years: list[str] = Query(default=[]),
    quarters: list[str] = Query(default=[]),
    months: list[str] = Query(default=[]),
    departments: list[str] = Query(default=[]),
    session: AsyncSession = Depends(get_db_session),
) -> PlanningAnalyticsResponse:
    return await build_planning_analytics(
        session,
        granularity=granularity,
        years=years,
        quarters=quarters,
        months=months,
        departments=departments,
    )
