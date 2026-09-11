from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.models.checks import CheckStatus
from app.schemas.common import ListResponse, OptionalDate


class CheckBase(BaseModel):
    check_name: str = Field(..., min_length=1, max_length=255)
    short_name: str | None = Field(None, max_length=255)
    check_type: str = Field(..., min_length=1, max_length=32)
    check_view: str = Field(..., min_length=1, max_length=255)
    check_quarter: int = Field(..., ge=1, le=4)
    start_date: date
    end_date: OptionalDate = None
    check_leader: str = Field(..., min_length=1, max_length=255)
    status: CheckStatus
    created_at: OptionalDate = None
    description: str | None = None
    order_document_number: str | None = Field(None, max_length=128)
    order_document_date: OptionalDate = None
    program_document_number: str | None = Field(None, max_length=128)
    program_document_date: OptionalDate = None
    az_document_number: str | None = Field(None, max_length=128)
    az_document_date: OptionalDate = None
    dz_document_number: str | None = Field(None, max_length=128)
    dz_document_date: OptionalDate = None
    process_effectiveness: str | None = Field(None, max_length=255)
    svk_effectiveness: str | None = Field(None, max_length=255)
    sur_effectiveness: str | None = Field(None, max_length=255)
    svik_effectiveness: str | None = Field(None, max_length=255)


class CheckCreate(CheckBase):
    pass


class CheckUpdate(BaseModel):
    check_name: str | None = Field(None, min_length=1, max_length=255)
    short_name: str | None = Field(None, max_length=255)
    check_type: str | None = Field(None, min_length=1, max_length=32)
    check_view: str | None = Field(None, min_length=1, max_length=255)
    check_quarter: int | None = Field(None, ge=1, le=4)
    start_date: OptionalDate = None
    end_date: OptionalDate = None
    check_leader: str | None = Field(None, min_length=1, max_length=255)
    status: CheckStatus | None = None
    description: str | None = None
    order_document_number: str | None = Field(None, max_length=128)
    order_document_date: OptionalDate = None
    program_document_number: str | None = Field(None, max_length=128)
    program_document_date: OptionalDate = None
    az_document_number: str | None = Field(None, max_length=128)
    az_document_date: OptionalDate = None
    dz_document_number: str | None = Field(None, max_length=128)
    dz_document_date: OptionalDate = None
    process_effectiveness: str | None = Field(None, max_length=255)
    svk_effectiveness: str | None = Field(None, max_length=255)
    sur_effectiveness: str | None = Field(None, max_length=255)
    svik_effectiveness: str | None = Field(None, max_length=255)


class CheckRead(CheckBase):
    id: int
    serial_number: str
    created_at: date

    model_config = ConfigDict(from_attributes=True)


class CheckListResponse(ListResponse[CheckRead]):
    pass
