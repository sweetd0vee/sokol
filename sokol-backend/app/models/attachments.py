from datetime import datetime
from enum import Enum

from sqlalchemy import BigInteger, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.columns import int_pk, required_string


class AttachmentEntityType(str, Enum):
    CHECK = "check"
    RECOMMENDATION = "recommendation"


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = int_pk()
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    slot: Mapped[str] = required_string(64)
    check_serial_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    bucket: Mapped[str] = required_string(128)
    object_key: Mapped[str] = required_string(512)
    original_name: Mapped[str] = required_string(512)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False, default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
