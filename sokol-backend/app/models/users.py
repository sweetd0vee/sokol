from uuid import UUID

from sqlalchemy import Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.columns import optional_string, required_string, unique_string, uuid_pk


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = uuid_pk()
    username: Mapped[str] = unique_string(index=True)
    password_hash: Mapped[str] = required_string()
    role: Mapped[str] = required_string(32)
    display_name: Mapped[str] = required_string()
    aliases: Mapped[str | None] = optional_string(500)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
