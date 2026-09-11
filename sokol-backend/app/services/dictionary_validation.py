"""Validate domain string fields against settings dictionaries and keep FKs satisfied."""

from __future__ import annotations

from typing import Any, Mapping, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import ColumnElement, select

from app.core.exceptions import DictionaryRefError, DuplicateDictionaryError
from app.crud.dictionary_crud import find_dictionary_duplicate_by_label
from app.models.auditors import Auditor
from app.models.check_kinds import CheckKind
from app.models.departments import Department
from app.models.effectiveness_ratings import EffectivenessRating
from app.services.dictionary_integrity import EFFECTIVENESS_FIELDS
from app.utils.dictionary_text import (
    UNSPECIFIED_AUDIT_OBJECT,
    find_dictionary_label_match,
    split_audit_object_values,
)

__all__ = [
    "DictionaryRefError",
    "assert_unique_dictionary_value",
    "canonicalize_audit_objects",
    "ensure_auditor_name",
    "ensure_check_kind_label",
    "ensure_effectiveness_rating_label",
    "validate_check_dictionary_fields",
    "validate_recommendation_dictionary_fields",
]


async def assert_unique_dictionary_value(
    session: AsyncSession,
    model: type,
    column: ColumnElement[Any],
    value: str,
    *,
    dictionary_name: str,
    exclude_id: UUID | None = None,
) -> None:
    duplicate = await find_dictionary_duplicate_by_label(
        session,
        model,
        column,
        value,
        exclude_id=exclude_id,
    )
    if duplicate is not None:
        raise DuplicateDictionaryError(dictionary=dictionary_name, label=value)


async def _label_exists(
    session: AsyncSession,
    model: type,
    column,
    value: str,
) -> bool:
    return (
        await find_dictionary_duplicate_by_label(session, model, column, value)
        is not None
    )


async def ensure_auditor_name(
    session: AsyncSession, value: str, *, field: str
) -> None:
    normalized = value.strip()
    if not await _label_exists(session, Auditor, Auditor.full_name, normalized):
        raise DictionaryRefError(field=field, value=normalized, dictionary="auditors")


async def ensure_check_kind_label(
    session: AsyncSession, value: str, *, field: str = "check_view"
) -> None:
    normalized = value.strip()
    if not await _label_exists(session, CheckKind, CheckKind.label, normalized):
        raise DictionaryRefError(field=field, value=normalized, dictionary="check_kinds")


async def ensure_effectiveness_rating_label(
    session: AsyncSession, value: str, *, field: str
) -> None:
    normalized = value.strip()
    if not await _label_exists(
        session, EffectivenessRating, EffectivenessRating.label, normalized
    ):
        raise DictionaryRefError(
            field=field, value=normalized, dictionary="effectiveness_ratings"
        )


async def _department_names(session: AsyncSession) -> list[str]:
    result = await session.execute(select(Department.name).order_by(Department.name.asc()))
    return [name for name in result.scalars().all() if name and name.strip()]


async def canonicalize_audit_objects(session: AsyncSession, value: object) -> list[str]:
    parts = split_audit_object_values(value)
    if not parts:
        return [UNSPECIFIED_AUDIT_OBJECT]

    department_names = await _department_names(session)
    canonical: list[str] = []
    unmatched: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if part == UNSPECIFIED_AUDIT_OBJECT:
            if part not in seen:
                canonical.append(part)
                seen.add(part)
            continue
        matched = find_dictionary_label_match(part, department_names)
        if matched is None:
            unmatched.append(part)
            continue
        if matched not in seen:
            canonical.append(matched)
            seen.add(matched)

    if unmatched:
        raise DictionaryRefError(
            field="audit_object",
            value=", ".join(unmatched),
            dictionary="departments",
        )
    return canonical or [UNSPECIFIED_AUDIT_OBJECT]


async def validate_check_dictionary_fields(
    session: AsyncSession,
    fields: Mapping[str, Optional[str]],
) -> None:
    """Validate check fields present in ``fields`` against dictionaries."""
    if "check_leader" in fields and fields["check_leader"] is not None:
        await ensure_auditor_name(
            session, fields["check_leader"], field="check_leader"
        )
    if "check_view" in fields and fields["check_view"] is not None:
        await ensure_check_kind_label(session, fields["check_view"])

    for field in EFFECTIVENESS_FIELDS:
        if field not in fields:
            continue
        value = fields[field]
        if value is None or not str(value).strip():
            continue
        await ensure_effectiveness_rating_label(session, str(value), field=field)


async def validate_recommendation_dictionary_fields(
    session: AsyncSession,
    fields: Mapping[str, Optional[str]],
) -> None:
    """Validate recommendation auditor against auditors dictionary.

    ``manager`` is руководитель объекта аудита (свободный текст), не из справочника auditors.
    """
    if "auditor" in fields and fields["auditor"] is not None:
        await ensure_auditor_name(session, fields["auditor"], field="auditor")
    if "audit_object" in fields and fields["audit_object"] is not None:
        await canonicalize_audit_objects(session, fields["audit_object"])
