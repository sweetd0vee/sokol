from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PeriodGranularity = Literal["year", "quarter", "month"]
EffectivenessTone = Literal["effective", "sufficient", "insufficient", "ineffective", "unset"]


class NamedCount(BaseModel):
    name: str
    value: int
    color: str | None = None


class RecommendationMaterialityCounts(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    низкий: int = 0
    средний: int = 0
    высокий: int = 0


class RecommendationObjectCount(NamedCount):
    materiality: RecommendationMaterialityCounts


class ChecksSummary(BaseModel):
    total: int
    not_started: int
    in_progress: int
    completed: int


class PeriodCount(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    label: str
    sort_key: int = Field(serialization_alias="sortKey")
    total: int
    not_started: int
    in_progress: int
    completed: int
    cumulative: int = 0


class EffectivenessRatings(BaseModel):
    process: str
    svk: str
    sur: str
    svik: str


class EffectivenessTones(BaseModel):
    process: EffectivenessTone
    svk: EffectivenessTone
    sur: EffectivenessTone
    svik: EffectivenessTone


class EffectivenessMatrixRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    key: str
    short_name: str = Field(serialization_alias="shortName")
    name: str
    ratings: EffectivenessRatings
    tones: EffectivenessTones


class MaterialityMatrixRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    key: str
    short_name: str = Field(serialization_alias="shortName")
    name: str
    counts: RecommendationMaterialityCounts
    total: int = 0


class ChecksAnalyticsFilterOptions(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    auditors: list[str]
    departments: list[str]
    anchor_dates: list[str] = Field(serialization_alias="anchorDates")


class ChecksAnalyticsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    universe_total: int = Field(serialization_alias="universeTotal")
    filtered_total: int = Field(serialization_alias="filteredTotal")
    granularity: PeriodGranularity
    summary: ChecksSummary
    completion_share: int = Field(serialization_alias="completionShare")
    period_series: list[PeriodCount] = Field(serialization_alias="periodSeries")
    view_distribution: list[NamedCount] = Field(serialization_alias="viewDistribution")
    type_distribution: list[NamedCount] = Field(serialization_alias="typeDistribution")
    department_map: list[NamedCount] = Field(serialization_alias="departmentMap")
    effectiveness_matrix: list[EffectivenessMatrixRow] = Field(
        serialization_alias="effectivenessMatrix"
    )
    filter_options: ChecksAnalyticsFilterOptions = Field(serialization_alias="filterOptions")


class RecommendationsSummaryByStatus(BaseModel):
    completed: int
    unresolved: int
    on_control: int
    in_progress: int


class RecommendationsSummaryByMateriality(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    низкий: int
    средний: int
    высокий: int


class RecommendationsSummaryByAdditional(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    on_time: int
    deadline_violated: int
    on_control: int


class RecommendationsSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total: int
    by_status: RecommendationsSummaryByStatus = Field(serialization_alias="byStatus")
    by_materiality: RecommendationsSummaryByMateriality = Field(serialization_alias="byMateriality")
    by_additional: RecommendationsSummaryByAdditional = Field(serialization_alias="byAdditional")
    with_extensions: int = Field(serialization_alias="withExtensions")
    with_completion_date: int = Field(serialization_alias="withCompletionDate")
    completion_rate: int = Field(serialization_alias="completionRate")
    violation_rate: int = Field(serialization_alias="violationRate")


class RecommendationPeriodCount(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    label: str
    sort_key: int = Field(serialization_alias="sortKey")
    total: int
    completed: int
    unresolved: int
    on_control: int
    in_progress: int
    low: int
    medium: int
    high: int
    cumulative: int = 0
    cumulative_completed: int = Field(default=0, serialization_alias="cumulativeCompleted")


class RecommendationsAnalyticsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    universe_total: int = Field(serialization_alias="universeTotal")
    filtered_total: int = Field(serialization_alias="filteredTotal")
    granularity: PeriodGranularity
    summary: RecommendationsSummary
    period_series: list[RecommendationPeriodCount] = Field(serialization_alias="periodSeries")
    cumulative_series: list[RecommendationPeriodCount] = Field(serialization_alias="cumulativeSeries")
    materiality_distribution: list[NamedCount] = Field(serialization_alias="materialityDistribution")
    indicator_distribution: list[NamedCount] = Field(serialization_alias="indicatorDistribution")
    check_links: list[NamedCount] = Field(serialization_alias="checkLinks")
    materiality_matrix: list[MaterialityMatrixRow] = Field(serialization_alias="materialityMatrix")
    object_distribution: list[RecommendationObjectCount] = Field(serialization_alias="objectDistribution")
    status_distribution: list[NamedCount] = Field(serialization_alias="statusDistribution")
    additional_status_distribution: list[NamedCount] = Field(
        serialization_alias="additionalStatusDistribution"
    )
    filter_options: ChecksAnalyticsFilterOptions = Field(serialization_alias="filterOptions")


class MonitoringAnalyticsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    universe_total: int = Field(serialization_alias="universeTotal")
    filtered_total: int = Field(serialization_alias="filteredTotal")
    granularity: PeriodGranularity
    summary: RecommendationsSummary
    period_series: list[RecommendationPeriodCount] = Field(serialization_alias="periodSeries")
    status_distribution: list[NamedCount] = Field(serialization_alias="statusDistribution")
    additional_status_distribution: list[NamedCount] = Field(
        serialization_alias="additionalStatusDistribution"
    )
    filter_options: ChecksAnalyticsFilterOptions = Field(serialization_alias="filterOptions")


class PeriodBucketSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    label: str
    sort_key: int = Field(serialization_alias="sortKey")


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
    portfolio_series: list[DvaPortfolioPoint] = Field(serialization_alias="portfolioSeries")
    auditor_load: list[DvaAuditorLoadRow] = Field(serialization_alias="auditorLoad")
    auditor_matrix: DvaAuditorMatrix = Field(serialization_alias="auditorMatrix")
    document_readiness: list[DocumentReadinessRow] = Field(serialization_alias="documentReadiness")
    auditor_checks_treemap: list[NamedCount] = Field(serialization_alias="auditorChecksTreemap")
    auditor_recommendations_treemap: list[NamedCount] = Field(
        serialization_alias="auditorRecommendationsTreemap"
    )
    department_map: list[NamedCount] = Field(serialization_alias="departmentMap")
    filter_options: ChecksAnalyticsFilterOptions = Field(serialization_alias="filterOptions")


class PlanningCoverageDonutSlice(BaseModel):
    name: str
    value: int
    color: str


class PlanningCoverage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    covered: int
    uncovered: int
    total: int
    coverage_rate: int = Field(serialization_alias="coverageRate")
    uncovered_rate: int = Field(serialization_alias="uncoveredRate")
    covered_departments: list[str] = Field(serialization_alias="coveredDepartments")
    uncovered_departments: list[str] = Field(serialization_alias="uncoveredDepartments")
    donut: list[PlanningCoverageDonutSlice]
    checks_by_department: list[NamedCount] = Field(serialization_alias="checksByDepartment")


class PlanningDepartmentAnalyticsRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    checks: int
    recommendations: int
    high_materiality: int = Field(serialization_alias="highMateriality")


class PlanningAnalyticsFilterOptions(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    departments: list[str]
    anchor_dates: list[str] = Field(serialization_alias="anchorDates")


class PlanningAnalyticsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    universe_checks_total: int = Field(serialization_alias="universeChecksTotal")
    universe_recommendations_total: int = Field(serialization_alias="universeRecommendationsTotal")
    filtered_checks_total: int = Field(serialization_alias="filteredChecksTotal")
    filtered_recommendations_total: int = Field(serialization_alias="filteredRecommendationsTotal")
    granularity: PeriodGranularity
    coverage: PlanningCoverage
    department_analytics: list[PlanningDepartmentAnalyticsRow] = Field(
        serialization_alias="departmentAnalytics"
    )
    high_materiality_by_department: list[NamedCount] = Field(
        serialization_alias="highMaterialityByDepartment"
    )
    high_materiality_total: int = Field(serialization_alias="highMaterialityTotal")
    filter_options: PlanningAnalyticsFilterOptions = Field(serialization_alias="filterOptions")
