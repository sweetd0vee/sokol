"""Reusable SQLAlchemy column factories for keys, dictionary FKs and value enums."""

from enum import Enum
from typing import TypeVar
from uuid import uuid4

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import mapped_column

E = TypeVar("E", bound=Enum)


def uuid_pk():
    return mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )


def int_pk():
    return mapped_column(Integer, primary_key=True, index=True)


def unique_string(length: int = 255, *, index: bool = False):
    return mapped_column(String(length), nullable=False, unique=True, index=index)


def required_string(length: int = 255, *, index: bool = False):
    return mapped_column(String(length), nullable=False, index=index)


def optional_string(length: int):
    return mapped_column(String(length), nullable=True)


def optional_date():
    return mapped_column(Date, nullable=True)


def required_date():
    return mapped_column(Date, nullable=False)


def dictionary_fk(
    target: str,
    constraint_name: str,
    *,
    ondelete: str = "RESTRICT",
    nullable: bool = False,
    index: bool = False,
    primary_key: bool = False,
):
    return mapped_column(
        String(255),
        ForeignKey(
            target,
            name=constraint_name,
            onupdate="CASCADE",
            ondelete=ondelete,
        ),
        nullable=nullable,
        index=index,
        primary_key=primary_key,
    )


def auditor_fk(constraint_name: str, *, index: bool = False):
    return dictionary_fk("auditors.full_name", constraint_name, index=index)


def check_kind_fk(constraint_name: str):
    return dictionary_fk("check_kinds.label", constraint_name)


def effectiveness_fk(constraint_name: str):
    return dictionary_fk(
        "effectiveness_ratings.label",
        constraint_name,
        ondelete="SET NULL",
        nullable=True,
    )


def department_name_fk(constraint_name: str, *, primary_key: bool = False, index: bool = False):
    return dictionary_fk(
        "departments.name",
        constraint_name,
        primary_key=primary_key,
        index=index,
    )


def value_enum_column(enum_cls: type[E], name: str):
    """Postgres enum persisted by member values (not names)."""
    return mapped_column(
        SAEnum(
            enum_cls,
            name=name,
            values_callable=lambda cls: [item.value for item in cls],
        ),
        nullable=False,
    )
