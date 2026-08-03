from datetime import date
from enum import Enum
from typing import Any

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class RecommendationStatus(str, Enum):
    COMPLETED = "completed"
    UNRESOLVED = "unresolved"
    ON_CONTROL = "on_control"
    IN_PROGRESS = "in_progress"


class RecommendationAdditionalStatus(str, Enum):
    ON_TIME = "on_time"
    DEADLINE_VIOLATED = "deadline_violated"
    ON_CONTROL = "on_control"


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    check_id: Mapped[int] = mapped_column(ForeignKey("checks.id", ondelete="CASCADE"), nullable=False, index=True)
    serial_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    indicator: Mapped[str] = mapped_column(String(32), nullable=False, default="не указан")
    materiality_level: Mapped[str] = mapped_column(String(32), nullable=False, default="средний")
    audit_object: Mapped[str] = mapped_column(String(255), nullable=False)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    auditor: Mapped[str] = mapped_column(String(255), nullable=False)
    manager: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[RecommendationStatus] = mapped_column(
        SAEnum(
            RecommendationStatus,
            name="recommendation_status",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
    )
    additional_status: Mapped[RecommendationAdditionalStatus] = mapped_column(
        SAEnum(
            RecommendationAdditionalStatus,
            name="recommendation_additional_status",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
    )
    created_at: Mapped[date] = mapped_column(Date, nullable=False)
    actual_completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    extension_1_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    extension_1_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    extension_1_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    extension_2_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    extension_2_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    remove_from_control_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    remove_from_control_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remove_from_control_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline_extensions: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    control_removals: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    closure_verification_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    closure_information: Mapped[str | None] = mapped_column(Text, nullable=True)

    check: Mapped["Check"] = relationship("Check", back_populates="recommendations")
