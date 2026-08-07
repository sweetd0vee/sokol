from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CheckKindBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)


class CheckKindCreate(CheckKindBase):
    pass


class CheckKindUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=255)


class CheckKindRead(CheckKindBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)


class CheckKindListResponse(BaseModel):
    items: list[CheckKindRead]
    total: int
