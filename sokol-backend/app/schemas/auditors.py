from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AuditorBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()


class AuditorCreate(AuditorBase):
    pass


class AuditorUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: Optional[str]) -> Optional[str]:
        return value.strip().upper() if value is not None else None


class AuditorRead(AuditorBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)


class AuditorListResponse(BaseModel):
    items: list[AuditorRead]
    total: int
