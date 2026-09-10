from datetime import date as Date
from typing import Literal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus
from app.schemas.common import ListResponse, parse_optional_date
from app.utils.dictionary_text import normalize_audit_object_input


class ClosureDateCommentItem(BaseModel):
    date: Optional[Date] = None
    comment: Optional[str] = None

    @field_validator("date", mode="before")
    @classmethod
    def empty_date_to_none(cls, value: object) -> object:
        return parse_optional_date(value)


def _normalize_closure_items(value: object) -> object:
    if value is None:
        return None
    if not isinstance(value, list):
        return []
    return value


class RecommendationBase(BaseModel):
    serial_number: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1)
    observation_name: Optional[str] = None
    description: str = ""
    indicator: str = Field(default="не указан", max_length=32)
    additional_indicator: str = Field(default="не указан", max_length=32)
    materiality_level: str = Field(default="средний", max_length=32)
    audit_object: list[str] = Field(..., min_length=1)
    deadline: Optional[Date] = None
    execution_deadline: Optional[Date] = None
    auditor: str = Field(..., min_length=1, max_length=255)
    manager: str = Field(..., min_length=1, max_length=255)
    status: RecommendationStatus
    additional_status: RecommendationAdditionalStatus
    created_at: Optional[Date] = None
    actual_completion_date: Optional[Date] = None
    extension_1_reason: Optional[str] = Field(None, max_length=64)
    extension_1_date: Optional[Date] = None
    extension_1_comment: Optional[str] = None
    extension_2_reason: Optional[str] = Field(None, max_length=64)
    extension_2_comment: Optional[str] = None
    remove_from_control_reason: Optional[str] = Field(None, max_length=64)
    remove_from_control_date: Optional[Date] = None
    remove_from_control_comment: Optional[str] = None
    deadline_extensions: Optional[list[ClosureDateCommentItem]] = None
    control_removals: Optional[list[ClosureDateCommentItem]] = None
    closure_verification_status: Optional[str] = Field(None, max_length=64)
    closure_information: Optional[str] = None

    @field_validator("additional_indicator", mode="before")
    @classmethod
    def empty_additional_indicator(cls, value: object) -> object:
        if value is None:
            return "не указан"
        if isinstance(value, str) and not value.strip():
            return "не указан"
        return value

    @field_validator(
        "deadline",
        "execution_deadline",
        "created_at",
        "actual_completion_date",
        "extension_1_date",
        "remove_from_control_date",
        mode="before",
    )
    @classmethod
    def empty_date_to_none(cls, value: object) -> object:
        return parse_optional_date(value)

    @field_validator("deadline_extensions", "control_removals", mode="before")
    @classmethod
    def normalize_closure_lists(cls, value: object) -> object:
        return _normalize_closure_items(value)

    @field_validator("audit_object", mode="before")
    @classmethod
    def normalize_audit_object(cls, value: object) -> list[str]:
        return normalize_audit_object_input(value)


class RecommendationCreate(RecommendationBase):
    pass


class RecommendationUpdate(BaseModel):
    serial_number: Optional[str] = Field(None, min_length=1, max_length=32)
    name: Optional[str] = Field(None, min_length=1)
    observation_name: Optional[str] = None
    description: Optional[str] = None
    indicator: Optional[str] = Field(None, max_length=32)
    additional_indicator: Optional[str] = Field(None, max_length=32)
    materiality_level: Optional[str] = Field(None, max_length=32)
    audit_object: Optional[list[str]] = Field(None, min_length=1)
    deadline: Optional[Date] = None
    execution_deadline: Optional[Date] = None
    auditor: Optional[str] = Field(None, min_length=1, max_length=255)
    manager: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[RecommendationStatus] = None
    additional_status: Optional[RecommendationAdditionalStatus] = None
    actual_completion_date: Optional[Date] = None
    extension_1_reason: Optional[str] = Field(None, max_length=64)
    extension_1_date: Optional[Date] = None
    extension_1_comment: Optional[str] = None
    extension_2_reason: Optional[str] = Field(None, max_length=64)
    extension_2_comment: Optional[str] = None
    remove_from_control_reason: Optional[str] = Field(None, max_length=64)
    remove_from_control_date: Optional[Date] = None
    remove_from_control_comment: Optional[str] = None
    deadline_extensions: Optional[list[ClosureDateCommentItem]] = None
    control_removals: Optional[list[ClosureDateCommentItem]] = None
    closure_verification_status: Optional[str] = Field(None, max_length=64)
    closure_information: Optional[str] = None

    @field_validator(
        "deadline",
        "execution_deadline",
        "actual_completion_date",
        "extension_1_date",
        "remove_from_control_date",
        mode="before",
    )
    @classmethod
    def empty_date_to_none(cls, value: object) -> object:
        return parse_optional_date(value)

    @field_validator("deadline_extensions", "control_removals", mode="before")
    @classmethod
    def normalize_closure_lists(cls, value: object) -> object:
        return _normalize_closure_items(value)

    @field_validator("audit_object", mode="before")
    @classmethod
    def normalize_audit_object(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        return normalize_audit_object_input(value)


class RecommendationRead(RecommendationBase):
    id: int
    sequence_number: int
    created_at: Date

    model_config = ConfigDict(from_attributes=True)


class RecommendationListResponse(ListResponse[RecommendationRead]):
    pass


class RecommendationBatchRequest(BaseModel):
    serial_number: str = Field(..., min_length=1, max_length=32)
    mode: Literal["append", "replace"] = "append"
    items: list[RecommendationCreate] = Field(..., min_length=1, max_length=200)


class RecommendationBatchDeleteRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=200)
