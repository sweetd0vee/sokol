"""Validate domain string fields against embedded settings dictionaries."""

from __future__ import annotations

import re

from sokol_reports.dictionaries.department_names import DEPARTMENTS
from sokol_reports.dictionaries.dictionary_text import find_dictionary_label_match


class DictionaryRefError(ValueError):
    """Raised when a domain field value is missing from a settings dictionary."""

    def __init__(self, *, field: str, value: str, dictionary: str) -> None:
        self.field = field
        self.value = value
        self.dictionary = dictionary
        super().__init__(
            f"Значение «{value}» поля «{field}» отсутствует в справочнике «{dictionary}»."
        )


def _split_audit_object_values(value: object) -> list[str]:
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            parts.extend(_split_audit_object_values(item))
        return parts
    if value is None:
        return []
    return [part.strip() for part in re.split(r"[;,]", str(value)) if part.strip()]


def canonicalize_audit_objects(
    value: object,
    *,
    department_names: list[str] | None = None,
) -> list[str]:
    parts = _split_audit_object_values(value)
    if not parts:
        return ["Не указан"]

    candidates = department_names if department_names is not None else list(DEPARTMENTS)
    canonical: list[str] = []
    unmatched: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if part == "Не указан":
            if part not in seen:
                canonical.append(part)
                seen.add(part)
            continue
        matched = find_dictionary_label_match(part, candidates)
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
