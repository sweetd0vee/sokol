from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EffectivenessRatingBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)


class EffectivenessRatingCreate(EffectivenessRatingBase):
    pass


class EffectivenessRatingUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=255)


class EffectivenessRatingRead(EffectivenessRatingBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)


class EffectivenessRatingListResponse(BaseModel):
    items: list[EffectivenessRatingRead]
    total: int
