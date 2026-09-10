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


class AuditorCheckCount(NamedCount):
    views: list[NamedCount] = Field(default_factory=list)


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


class ChecksAnalyticsFilterOptions(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    auditors: list[str]
    departments: list[str]
    anchor_dates: list[str] = Field(serialization_alias="anchorDates")


class PeriodBucketSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    label: str
    sort_key: int = Field(serialization_alias="sortKey")

