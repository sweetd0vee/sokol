from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus
from app.schemas.common import ListResponse, OptionalDate
from app.utils.dictionary_text import normalize_audit_object_input


class ClosureDateCommentItem(BaseModel):
    date: OptionalDate = None
    comment: str | None = None


def _normalize_closure_items(value: object) -> object:
    if value is None:
        return None
    if not isinstance(value, list):
        return []
    return value


class RecommendationClosureFields(BaseModel):
    actual_completion_date: OptionalDate = None
    extension_1_reason: str | None = Field(None, max_length=64)
    extension_1_date: OptionalDate = None
    extension_1_comment: str | None = None
    extension_2_reason: str | None = Field(None, max_length=64)
    extension_2_comment: str | None = None
    remove_from_control_reason: str | None = Field(None, max_length=64)
    remove_from_control_date: OptionalDate = None
    remove_from_control_comment: str | None = None
    deadline_extensions: list[ClosureDateCommentItem] | None = None
    control_removals: list[ClosureDateCommentItem] | None = None
    closure_verification_status: str | None = Field(None, max_length=64)
    closure_information: str | None = None

    @field_validator("deadline_extensions", "control_removals", mode="before")
    @classmethod
    def normalize_closure_lists(cls, value: object) -> object:
        return _normalize_closure_items(value)


class RecommendationBase(RecommendationClosureFields):
    serial_number: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1)
    observation_name: str | None = None
    description: str = ""
    indicator: str = Field(default="не указан", max_length=32)
    additional_indicator: str = Field(default="не указан", max_length=32)
    materiality_level: str = Field(default="средний", max_length=32)
    audit_object: list[str] = Field(..., min_length=1)
    deadline: OptionalDate = None
    execution_deadline: OptionalDate = None
    auditor: str = Field(..., min_length=1, max_length=255)
    manager: str = Field(..., min_length=1, max_length=255)
    status: RecommendationStatus
    additional_status: RecommendationAdditionalStatus
    created_at: OptionalDate = None

    @field_validator("additional_indicator", mode="before")
    @classmethod
    def empty_additional_indicator(cls, value: object) -> object:
        if value is None:
            return "не указан"
        if isinstance(value, str) and not value.strip():
            return "не указан"
        return value

    @field_validator("audit_object", mode="before")
    @classmethod
    def normalize_audit_object(cls, value: object) -> list[str]:
        return normalize_audit_object_input(value)


class RecommendationCreate(RecommendationBase):
    pass


class RecommendationUpdate(RecommendationClosureFields):
    serial_number: str | None = Field(None, min_length=1, max_length=32)
    name: str | None = Field(None, min_length=1)
    observation_name: str | None = None
    description: str | None = None
    indicator: str | None = Field(None, max_length=32)
    additional_indicator: str | None = Field(None, max_length=32)
    materiality_level: str | None = Field(None, max_length=32)
    audit_object: list[str] | None = Field(None, min_length=1)
    deadline: OptionalDate = None
    execution_deadline: OptionalDate = None
    auditor: str | None = Field(None, min_length=1, max_length=255)
    manager: str | None = Field(None, min_length=1, max_length=255)
    status: RecommendationStatus | None = None
    additional_status: RecommendationAdditionalStatus | None = None

    @field_validator("audit_object", mode="before")
    @classmethod
    def normalize_audit_object(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        return normalize_audit_object_input(value)


class RecommendationRead(RecommendationBase):
    id: int
    sequence_number: int
    created_at: date
    created_by: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RecommendationListResponse(ListResponse[RecommendationRead]):
    pass


class RecommendationBatchRequest(BaseModel):
    serial_number: str = Field(..., min_length=1, max_length=32)
    mode: Literal["append", "replace"] = "append"
    items: list[RecommendationCreate] = Field(..., min_length=1, max_length=200)


class RecommendationBatchDeleteRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=200)
