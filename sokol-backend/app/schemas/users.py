from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.roles import Role
from app.schemas.common import ListResponse


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=4, max_length=128)
    role: Role = Role.AUDITOR
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    aliases: list[str] = Field(default_factory=list)


class UserRead(BaseModel):
    id: UUID
    username: str
    display_name: str
    role: Role
    aliases: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class UserListResponse(ListResponse[UserRead]):
    pass
