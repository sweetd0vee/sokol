from datetime import date
from enum import Enum

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CheckStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Check(Base):
    __tablename__ = "checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    serial_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    check_name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    check_type: Mapped[str] = mapped_column(String(32), nullable=False)
    check_view: Mapped[str] = mapped_column(
        String(255),
        ForeignKey(
            "check_kinds.label",
            name="fk_checks_check_view",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    check_quarter: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    check_leader: Mapped[str] = mapped_column(
        String(255),
        ForeignKey(
            "auditors.full_name",
            name="fk_checks_check_leader",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    status: Mapped[CheckStatus] = mapped_column(
        SAEnum(CheckStatus, name="check_status"),
        nullable=False,
    )
    created_at: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_document_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    order_document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    program_document_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    program_document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    az_document_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    az_document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    dz_document_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    dz_document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    process_effectiveness: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey(
            "effectiveness_ratings.label",
            name="fk_checks_process_effectiveness",
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    svk_effectiveness: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey(
            "effectiveness_ratings.label",
            name="fk_checks_svk_effectiveness",
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    sur_effectiveness: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey(
            "effectiveness_ratings.label",
            name="fk_checks_sur_effectiveness",
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    svik_effectiveness: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey(
            "effectiveness_ratings.label",
            name="fk_checks_svik_effectiveness",
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    recommendations: Mapped[list["Recommendation"]] = relationship(
        "Recommendation",
        back_populates="check",
        cascade="all, delete-orphan",
    )
