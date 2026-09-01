from uuid import UUID

from sqlalchemy.orm import DeclarativeBase, Mapped

from app.models.columns import unique_string, uuid_pk


class Base(DeclarativeBase):
    pass


class DictionaryLabelModel(Base):
    """Settings dictionary keyed by a unique human-readable label."""

    __abstract__ = True

    id: Mapped[UUID] = uuid_pk()
    label: Mapped[str] = unique_string()
