from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analytics.common import (
    ChecksAnalyticsFilterOptions,
    ChecksSummary,
    EffectivenessTone,
    NamedCount,
    PeriodCount,
    PeriodGranularity,
)


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
