from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditorBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)


class AuditorCreate(AuditorBase):
    pass


class AuditorUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)


class AuditorRead(AuditorBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)


class AuditorListResponse(BaseModel):
    items: list[AuditorRead]
    total: int
