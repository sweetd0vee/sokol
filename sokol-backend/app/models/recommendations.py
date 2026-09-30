from datetime import date
from enum import Enum
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.columns import (
    auditor_fk,
    department_name_fk,
    int_pk,
    optional_date,
    optional_string,
    required_date,
    required_string,
    value_enum_column,
)


class RecommendationStatus(str, Enum):
    COMPLETED = "completed"
    UNRESOLVED = "unresolved"
    ON_CONTROL = "on_control"
    IN_PROGRESS = "in_progress"


class RecommendationAdditionalStatus(str, Enum):
    ON_TIME = "on_time"
    DEADLINE_VIOLATED = "deadline_violated"
    ON_CONTROL = "on_control"
    IN_PROGRESS = "in_progress"


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        Index("ix_recommendations_deadline", "deadline"),
        Index("ix_recommendations_status", "status"),
        Index("ix_recommendations_materiality_level", "materiality_level"),
        Index("ix_recommendations_deadline_status", "deadline", "status"),
        Index(
            "ix_recommendations_audit_object_gin",
            "audit_object",
            postgresql_using="gin",
        ),
    )

    id: Mapped[int] = int_pk()
    check_id: Mapped[int] = mapped_column(ForeignKey("checks.id", ondelete="CASCADE"), nullable=False, index=True)
    serial_number: Mapped[str] = required_string(32, index=True)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    observation_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    indicator: Mapped[str] = mapped_column(String(32), nullable=False, default="не указан")
    additional_indicator: Mapped[str] = mapped_column(String(32), nullable=False, default="не указан")
    materiality_level: Mapped[str] = mapped_column(String(32), nullable=False, default="средний")
    audit_object: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    deadline: Mapped[date | None] = optional_date()
    execution_deadline: Mapped[date | None] = optional_date()
    auditor: Mapped[str] = auditor_fk("fk_recommendations_auditor", index=True)
    manager: Mapped[str] = required_string()
    status: Mapped[RecommendationStatus] = value_enum_column(
        RecommendationStatus,
        "recommendation_status",
    )
    additional_status: Mapped[RecommendationAdditionalStatus] = value_enum_column(
        RecommendationAdditionalStatus,
        "recommendation_additional_status",
    )
    created_at: Mapped[date] = required_date()
    created_by: Mapped[str | None] = optional_string(255)
    actual_completion_date: Mapped[date | None] = optional_date()
    extension_1_reason: Mapped[str | None] = optional_string(64)
    extension_1_date: Mapped[date | None] = optional_date()
    extension_1_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    extension_2_reason: Mapped[str | None] = optional_string(64)
    extension_2_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    remove_from_control_reason: Mapped[str | None] = optional_string(64)
    remove_from_control_date: Mapped[date | None] = optional_date()
    remove_from_control_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline_extensions: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    control_removals: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    closure_verification_status: Mapped[str | None] = optional_string(64)
    closure_information: Mapped[str | None] = mapped_column(Text, nullable=True)

    check: Mapped["Check"] = relationship("Check", back_populates="recommendations")
    audit_object_rows: Mapped[list["RecommendationAuditObject"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class RecommendationAuditObject(Base):
    """FK-backed link between a recommendation and departments from the dictionary."""

    __tablename__ = "recommendation_audit_objects"

    recommendation_id: Mapped[int] = mapped_column(
        ForeignKey(
            "recommendations.id",
            name="fk_recommendation_audit_objects_recommendation",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )
    department_name: Mapped[str] = department_name_fk(
        "fk_recommendation_audit_objects_department",
        primary_key=True,
        index=True,
    )
