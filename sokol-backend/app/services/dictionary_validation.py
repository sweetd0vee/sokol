"""Validate domain string fields against settings dictionaries (no FK)."""

from __future__ import annotations

from typing import Mapping, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.crud.dictionary_crud import find_dictionary_duplicate_by_label
from app.models.auditors import Auditor
from app.models.check_kinds import CheckKind
from app.models.departments import Department
from app.models.effectiveness_ratings import EffectivenessRating
from app.utils.dictionary_text import dictionary_match_key


class DictionaryRefError(ValueError):
    """Raised when a domain field value is missing from a settings dictionary."""

    def __init__(self, *, field: str, value: str, dictionary: str) -> None:
        self.field = field
        self.value = value
        self.dictionary = dictionary
        super().__init__(
            f"Значение «{value}» поля «{field}» отсутствует в справочнике «{dictionary}»."
        )


async def _value_exists(
    session: AsyncSession,
    model: type,
    column,
    value: str,
) -> bool:
    duplicate = await find_dictionary_duplicate_by_label(session, model, column, value)
    return duplicate is not None


async def ensure_auditor_name(
    session: AsyncSession, value: str, *, field: str
) -> None:
    normalized = value.strip()
    if not await _value_exists(session, Auditor, Auditor.full_name, normalized):
        raise DictionaryRefError(field=field, value=normalized, dictionary="auditors")


async def ensure_check_kind_label(
    session: AsyncSession, value: str, *, field: str = "check_view"
) -> None:
    normalized = value.strip()
    if not await _value_exists(session, CheckKind, CheckKind.label, normalized):
        raise DictionaryRefError(field=field, value=normalized, dictionary="check_kinds")


async def ensure_effectiveness_rating_label(
    session: AsyncSession, value: str, *, field: str
) -> None:
    normalized = value.strip()
    if not await _value_exists(
        session, EffectivenessRating, EffectivenessRating.label, normalized
    ):
        raise DictionaryRefError(
            field=field, value=normalized, dictionary="effectiveness_ratings"
        )


def _split_audit_object_values(value: object) -> list[str]:
    import re

    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            parts.extend(_split_audit_object_values(item))
        return parts
    if value is None:
        return []
    return [part.strip() for part in re.split(r"[;,]", str(value)) if part.strip()]


async def _department_lookup(session: AsyncSession) -> dict[str, str]:
    result = await session.execute(select(Department.name).order_by(Department.name.asc()))
    names = [name for name in result.scalars().all() if name and name.strip()]
    if not names:
        from app.db.department_names import DEPARTMENTS

        names = list(DEPARTMENTS)
    return {dictionary_match_key(name): name for name in names}


async def canonicalize_audit_objects(session: AsyncSession, value: object) -> list[str]:
    parts = _split_audit_object_values(value)
    if not parts:
        return ["Не указан"]

    lookup = await _department_lookup(session)
    canonical: list[str] = []
    unmatched: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if part == "Не указан":
            if part not in seen:
                canonical.append(part)
                seen.add(part)
            continue
        matched = lookup.get(dictionary_match_key(part))
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
    return canonical or ["Не указан"]


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

    for field in (
        "process_effectiveness",
        "svk_effectiveness",
        "sur_effectiveness",
        "svik_effectiveness",
    ):
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
