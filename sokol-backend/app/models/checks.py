from datetime import date
from enum import Enum

from sqlalchemy import Enum as SAEnum, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.columns import (
    auditor_fk,
    check_kind_fk,
    effectiveness_fk,
    int_pk,
    optional_date,
    optional_string,
    required_date,
    required_string,
    unique_string,
)


class CheckStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Check(Base):
    __tablename__ = "checks"

    id: Mapped[int] = int_pk()
    serial_number: Mapped[str] = unique_string(32, index=True)
    check_name: Mapped[str] = required_string()
    short_name: Mapped[str | None] = optional_string(255)
    check_type: Mapped[str] = required_string(32)
    check_view: Mapped[str] = check_kind_fk("fk_checks_check_view")
    check_quarter: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = required_date()
    end_date: Mapped[date | None] = optional_date()
    check_leader: Mapped[str] = auditor_fk("fk_checks_check_leader", index=True)
    status: Mapped[CheckStatus] = mapped_column(
        SAEnum(CheckStatus, name="check_status"),
        nullable=False,
    )
    created_at: Mapped[date] = required_date()
    created_by: Mapped[str | None] = optional_string(255)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_document_number: Mapped[str | None] = optional_string(128)
    order_document_date: Mapped[date | None] = optional_date()
    program_document_number: Mapped[str | None] = optional_string(128)
    program_document_date: Mapped[date | None] = optional_date()
    az_document_number: Mapped[str | None] = optional_string(128)
    az_document_date: Mapped[date | None] = optional_date()
    dz_document_number: Mapped[str | None] = optional_string(128)
    dz_document_date: Mapped[date | None] = optional_date()
    process_effectiveness: Mapped[str | None] = effectiveness_fk("fk_checks_process_effectiveness")
    svk_effectiveness: Mapped[str | None] = effectiveness_fk("fk_checks_svk_effectiveness")
    sur_effectiveness: Mapped[str | None] = effectiveness_fk("fk_checks_sur_effectiveness")
    svik_effectiveness: Mapped[str | None] = effectiveness_fk("fk_checks_svik_effectiveness")

    recommendations: Mapped[list["Recommendation"]] = relationship(
        "Recommendation",
        back_populates="check",
        cascade="all, delete-orphan",
    )
