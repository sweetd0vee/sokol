from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditTypeBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=255)
    name: str = Field(..., min_length=1, max_length=255)


class AuditTypeCreate(AuditTypeBase):
    pass


class AuditTypeUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=255)
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class AuditTypeRead(AuditTypeBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)


class AuditTypeListResponse(BaseModel):
    items: list[AuditTypeRead]
    total: int
