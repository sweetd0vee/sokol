from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.checks import CheckStatus


class CheckBase(BaseModel):
    check_name: str = Field(..., min_length=1, max_length=255)
    short_name: Optional[str] = Field(None, max_length=255)
    check_type: str = Field(..., min_length=1, max_length=32)
    check_view: str = Field(..., min_length=1, max_length=255)
    check_quarter: int = Field(..., ge=1, le=4)
    start_date: date
    end_date: Optional[date] = None
    check_leader: str = Field(..., min_length=1, max_length=255)
    status: CheckStatus
    created_at: Optional[date] = None
    description: Optional[str] = None
    order_document_number: Optional[str] = Field(None, max_length=128)
    order_document_date: Optional[date] = None
    program_document_number: Optional[str] = Field(None, max_length=128)
    program_document_date: Optional[date] = None
    az_document_number: Optional[str] = Field(None, max_length=128)
    az_document_date: Optional[date] = None
    dz_document_number: Optional[str] = Field(None, max_length=128)
    dz_document_date: Optional[date] = None
    process_effectiveness: Optional[str] = Field(None, max_length=255)
    svk_effectiveness: Optional[str] = Field(None, max_length=255)
    sur_effectiveness: Optional[str] = Field(None, max_length=255)
    svik_effectiveness: Optional[str] = Field(None, max_length=255)


class CheckCreate(CheckBase):
    pass


class CheckUpdate(BaseModel):
    check_name: Optional[str] = Field(None, min_length=1, max_length=255)
    short_name: Optional[str] = Field(None, max_length=255)
    check_type: Optional[str] = Field(None, min_length=1, max_length=32)
    check_view: Optional[str] = Field(None, min_length=1, max_length=255)
    check_quarter: Optional[int] = Field(None, ge=1, le=4)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    check_leader: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[CheckStatus] = None
    description: Optional[str] = None
    order_document_number: Optional[str] = Field(None, max_length=128)
    order_document_date: Optional[date] = None
    program_document_number: Optional[str] = Field(None, max_length=128)
    program_document_date: Optional[date] = None
    az_document_number: Optional[str] = Field(None, max_length=128)
    az_document_date: Optional[date] = None
    dz_document_number: Optional[str] = Field(None, max_length=128)
    dz_document_date: Optional[date] = None
    process_effectiveness: Optional[str] = Field(None, max_length=255)
    svk_effectiveness: Optional[str] = Field(None, max_length=255)
    sur_effectiveness: Optional[str] = Field(None, max_length=255)
    svik_effectiveness: Optional[str] = Field(None, max_length=255)


class CheckRead(CheckBase):
    id: int
    serial_number: str
    created_at: date

    model_config = ConfigDict(from_attributes=True)


class CheckListResponse(BaseModel):
    items: list[CheckRead]
    total: int
