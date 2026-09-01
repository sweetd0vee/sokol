from uuid import UUID

from sqlalchemy.orm import Mapped

from app.models.base import Base
from app.models.columns import unique_string, uuid_pk


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[UUID] = uuid_pk()
    name: Mapped[str] = unique_string()
