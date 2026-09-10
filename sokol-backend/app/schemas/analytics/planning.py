from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analytics.common import NamedCount, PeriodGranularity
from app.schemas.analytics.dva import DvaCheckCountRef


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


class PlanningUnresolvedDepartmentRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    value: int
    checks: list[DvaCheckCountRef] = Field(default_factory=list)


class PlanningHighMaterialityDepartmentRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    value: int
    total: int
    checks: list[DvaCheckCountRef] = Field(default_factory=list)


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
    unresolved_by_department: list[PlanningUnresolvedDepartmentRow] = Field(
        default_factory=list, serialization_alias="unresolvedByDepartment"
    )
    high_materiality_by_department: list[PlanningHighMaterialityDepartmentRow] = Field(
        serialization_alias="highMaterialityByDepartment"
    )
    high_materiality_total: int = Field(serialization_alias="highMaterialityTotal")
    filter_options: PlanningAnalyticsFilterOptions = Field(serialization_alias="filterOptions")
