from uuid import UUID

from sqlalchemy.orm import Mapped

from app.models.base import Base
from app.models.columns import required_string, uuid_pk


class AuditType(Base):
    __tablename__ = "audit_types"

    id: Mapped[UUID] = uuid_pk()
    code: Mapped[str] = required_string()
    name: Mapped[str] = required_string()
