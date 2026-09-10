from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analytics.common import (
    ChecksAnalyticsFilterOptions,
    NamedCount,
    PeriodGranularity,
    RecommendationMaterialityCounts,
    RecommendationObjectCount,
)


class MaterialityMatrixRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    key: str
    short_name: str = Field(serialization_alias="shortName")
    name: str
    counts: RecommendationMaterialityCounts
    total: int = 0


class RecommendationsSummaryByStatus(BaseModel):
    completed: int
    unresolved: int
    on_control: int
    in_progress: int


class StatusMatrixRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    key: str
    short_name: str = Field(serialization_alias="shortName")
    name: str
    counts: RecommendationsSummaryByStatus
    total: int = 0


class DeadlineExtensionByCheckRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    key: str
    short_name: str = Field(serialization_alias="shortName")
    name: str
    value: int


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
    in_progress: int = 0


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
    materiality_distribution: list[NamedCount] = Field(serialization_alias="materialityDistribution")
    indicator_distribution: list[NamedCount] = Field(serialization_alias="indicatorDistribution")
    view_distribution: list[NamedCount] = Field(serialization_alias="viewDistribution")
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
    indicator_distribution: list[NamedCount] = Field(serialization_alias="indicatorDistribution")
    status_matrix: list[StatusMatrixRow] = Field(serialization_alias="statusMatrix")
    deadline_extensions_by_check: list[DeadlineExtensionByCheckRow] = Field(
        serialization_alias="deadlineExtensionsByCheck"
    )
    completed_during_audit_by_check: list[DeadlineExtensionByCheckRow] = Field(
        serialization_alias="completedDuringAuditByCheck"
    )
    filter_options: ChecksAnalyticsFilterOptions = Field(serialization_alias="filterOptions")
