"""Validate domain string fields against settings dictionaries (no FK)."""

from __future__ import annotations

from typing import Mapping, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_crud import find_dictionary_duplicate_by_label
from app.models.auditors import Auditor
from app.models.check_kinds import CheckKind
from app.models.effectiveness_ratings import EffectivenessRating


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
