from uuid import UUID

from sqlalchemy.orm import Mapped

from app.models.base import Base
from app.models.columns import unique_string, uuid_pk


class Auditor(Base):
    __tablename__ = "auditors"

    id: Mapped[UUID] = uuid_pk()
    full_name: Mapped[str] = unique_string()
    code: Mapped[str] = unique_string(3)
