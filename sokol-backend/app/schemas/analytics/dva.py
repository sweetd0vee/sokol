from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analytics.common import (
    AuditorCheckCount,
    ChecksAnalyticsFilterOptions,
    ChecksSummary,
    NamedCount,
    PeriodBucketSchema,
    PeriodGranularity,
)
from app.schemas.analytics.recommendations import RecommendationsSummary


class DvaPortfolioPoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    label: str
    sort_key: int = Field(serialization_alias="sortKey")
    checks: int
    recommendations: int


class DvaAuditorLoadRow(BaseModel):
    name: str
    checks: int
    recommendations: int
    value: int


class DvaAuditorMaterialityRow(BaseModel):
    name: str
    low: int
    medium: int
    high: int
    total: int


class DvaCheckCountRef(BaseModel):
    key: str
    short_name: str
    count: int


class DvaAuditorExecutionRow(BaseModel):
    name: str
    completed: int
    in_progress: int
    on_control: int
    unresolved: int
    total: int
    unresolved_checks: list[DvaCheckCountRef] = Field(default_factory=list)


class DvaAuditorTimelinessRow(BaseModel):
    name: str
    on_time: int
    deadline_violated: int
    on_control: int
    in_progress: int = 0
    total: int
    violation_rate: int


class DvaMissingCheckRef(BaseModel):
    key: str
    short_name: str


class DvaAuditorDocumentRow(BaseModel):
    name: str
    checks: int
    order_filled: int
    program_filled: int
    az_filled: int
    dz_filled: int
    readiness: int
    missing_order: list[DvaMissingCheckRef] = Field(default_factory=list)
    missing_program: list[DvaMissingCheckRef] = Field(default_factory=list)
    missing_az: list[DvaMissingCheckRef] = Field(default_factory=list)
    missing_dz: list[DvaMissingCheckRef] = Field(default_factory=list)


class DvaAuditorMatrixCell(BaseModel):
    checks: int
    recommendations: int


class DvaAuditorMatrixRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    auditor: str
    total: int
    by_period: dict[str, DvaAuditorMatrixCell] = Field(serialization_alias="byPeriod")


class DvaAuditorMatrix(BaseModel):
    periods: list[PeriodBucketSchema]
    rows: list[DvaAuditorMatrixRow]


class DocumentReadinessRow(BaseModel):
    name: str
    filled: int
    empty: int


class DvaCheckLifecycleRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    key: str
    short_name: str = Field(serialization_alias="shortName")
    auditor: str
    order_date: date | None = Field(default=None, serialization_alias="orderDate")
    program_date: date | None = Field(default=None, serialization_alias="programDate")
    az_date: date | None = Field(default=None, serialization_alias="azDate")
    dz_date: date | None = Field(default=None, serialization_alias="dzDate")


class DvaAnalyticsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    universe_checks_total: int = Field(serialization_alias="universeChecksTotal")
    universe_recommendations_total: int = Field(serialization_alias="universeRecommendationsTotal")
    filtered_checks_total: int = Field(serialization_alias="filteredChecksTotal")
    filtered_recommendations_total: int = Field(serialization_alias="filteredRecommendationsTotal")
    granularity: PeriodGranularity
    check_summary: ChecksSummary = Field(serialization_alias="checkSummary")
    recommendation_summary: RecommendationsSummary = Field(serialization_alias="recommendationSummary")
    completion_share: int = Field(serialization_alias="completionShare")
    average_check_duration_days: int = Field(serialization_alias="averageCheckDurationDays")
    portfolio_series: list[DvaPortfolioPoint] = Field(serialization_alias="portfolioSeries")
    auditor_load: list[DvaAuditorLoadRow] = Field(serialization_alias="auditorLoad")
    auditor_impact: list[DvaAuditorMaterialityRow] = Field(default_factory=list, serialization_alias="auditorImpact")
    auditor_execution: list[DvaAuditorExecutionRow] = Field(
        default_factory=list, serialization_alias="auditorExecution"
    )
    auditor_timeliness: list[DvaAuditorTimelinessRow] = Field(
        default_factory=list, serialization_alias="auditorTimeliness"
    )
    auditor_documents: list[DvaAuditorDocumentRow] = Field(
        default_factory=list, serialization_alias="auditorDocuments"
    )
    auditor_matrix: DvaAuditorMatrix = Field(serialization_alias="auditorMatrix")
    document_readiness: list[DocumentReadinessRow] = Field(serialization_alias="documentReadiness")
    check_lifecycle: list[DvaCheckLifecycleRow] = Field(
        default_factory=list, serialization_alias="checkLifecycle"
    )
    auditor_checks_treemap: list[AuditorCheckCount] = Field(serialization_alias="auditorChecksTreemap")
    auditor_recommendations_treemap: list[NamedCount] = Field(
        serialization_alias="auditorRecommendationsTreemap"
    )
    department_map: list[NamedCount] = Field(serialization_alias="departmentMap")
    filter_options: ChecksAnalyticsFilterOptions = Field(serialization_alias="filterOptions")
