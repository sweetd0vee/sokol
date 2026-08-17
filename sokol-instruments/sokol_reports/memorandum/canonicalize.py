"""Нормализация объектов аудита по встроенному справочнику департаментов."""

from __future__ import annotations

from sokol_reports.dictionaries.validation import canonicalize_audit_objects
from sokol_reports.memorandum.models import MemorandumAuditObject, MemorandumSource


def canonicalize_memorandum_source(
    source: MemorandumSource,
    *,
    department_names: list[str] | None = None,
) -> MemorandumSource:
    groups: list[MemorandumAuditObject] = []
    group_index: dict[tuple[str, str], int] = {}

    for group in source.groups:
        canonical_names = canonicalize_audit_objects(
            group.name,
            department_names=department_names,
        )
        canonical_name = "; ".join(sorted(canonical_names, key=str.casefold))
        manager = group.manager.strip()
        key = (canonical_name.casefold(), manager.casefold())
        if key not in group_index:
            group_index[key] = len(groups)
            groups.append(
                MemorandumAuditObject(
                    name=canonical_name,
                    manager=manager,
                    recommendations=[],
                )
            )
        groups[group_index[key]].recommendations.extend(group.recommendations)

    return MemorandumSource(groups=groups)
