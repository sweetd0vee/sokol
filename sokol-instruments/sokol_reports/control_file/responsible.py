"""Format «Ответственные» cells for the control-file workbook."""

from __future__ import annotations

import re

_MANAGER_INITIALS_RE = re.compile(
    r"^[А-ЯЁA-Z][а-яёa-z]+\s+[А-ЯЁA-Z]\.\s*[А-ЯЁA-Z]\.?$"
)


def _normalize_manager(manager: str) -> str:
    mgr = (manager or "").strip().rstrip(".")
    if mgr and _MANAGER_INITIALS_RE.match(mgr) and not mgr.endswith("."):
        mgr = f"{mgr}."
    return mgr


def _split_audit_objects(value: str) -> list[str]:
    parts = [
        re.sub(r"\s+", " ", part).strip().rstrip(".")
        for part in re.split(r",\s*", value or "")
    ]
    return [part for part in parts if part]


def _split_managers(value: str) -> list[str]:
    managers: list[str] = []
    for part in re.split(r",\s*", value or ""):
        manager = _normalize_manager(part)
        if manager:
            managers.append(manager)
    return managers


def _format_single_responsible(audit_object: str, manager: str) -> str:
    name = re.sub(r"\s+", " ", (audit_object or "").strip()).rstrip(".")
    mgr = _normalize_manager(manager)
    if name and mgr:
        return f"{name} ({mgr})"
    return name or mgr


def format_responsible_from_pairs(pairs: list[tuple[str, str]]) -> str:
    """Сформировать «Ответственные»: департамент (руководитель) для каждого объекта аудита."""
    if not pairs:
        return ""

    if len(pairs) > 1:
        formatted = [_format_single_responsible(obj, mgr) for obj, mgr in pairs if obj or mgr]
        return ", ".join(formatted)

    audit_object, manager = pairs[0]
    objects = _split_audit_objects(audit_object)
    managers = _split_managers(manager)

    if len(objects) > 1 and len(managers) > 1:
        limit = min(len(objects), len(managers))
        formatted = [
            _format_single_responsible(objects[index], managers[index])
            for index in range(limit)
        ]
        for extra_object in objects[limit:]:
            formatted.append(_format_single_responsible(extra_object, ""))
        for extra_manager in managers[limit:]:
            formatted.append(_format_single_responsible("", extra_manager))
        return ", ".join(part for part in formatted if part)

    return _format_single_responsible(
        objects[0] if objects else audit_object,
        managers[0] if managers else manager,
    )
