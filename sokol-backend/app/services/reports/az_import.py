"""Parse auditor-report DOCX into recommendation and memorandum payloads."""

from __future__ import annotations

import re
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.tools import ParsedRecommendationItem
from app.services.dictionary_validation import canonicalize_audit_objects
from app.services.reports.memorandum.models import MemorandumAuditObject, MemorandumSource
from app.services.reports.memorandum.parser import parse_az_for_memorandum


def deadline_to_iso(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip())
    match = re.match(r"^(\d{1,2})\.(\d{2})\.(\d{4})$", cleaned)
    if not match:
        return ""
    day, month, year = match.groups()
    try:
        date(int(year), int(month), int(day))
    except ValueError:
        return ""
    return f"{year}-{month}-{day.zfill(2)}"


async def canonicalize_memorandum_source(
    session: AsyncSession,
    source: MemorandumSource,
) -> MemorandumSource:
    groups: list[MemorandumAuditObject] = []
    group_index: dict[tuple[str, str], int] = {}

    for group in source.groups:
        canonical_names = await canonicalize_audit_objects(session, group.name)
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


def parse_recommendations_from_docx(input_path: str) -> tuple[list[ParsedRecommendationItem], str | None]:
    source, error = parse_az_for_memorandum(input_path)
    if error:
        return [], error
    if source is None:
        return [], "Не удалось разобрать рекомендации из аудиторского заключения."

    items: list[ParsedRecommendationItem] = []
    for group in source.groups:
        for recommendation in group.recommendations:
            name = " ".join(recommendation.paragraphs).strip()
            if not name and recommendation.deadline:
                name = "Рекомендация"
            if not name:
                continue
            items.append(
                ParsedRecommendationItem(
                    name=name,
                    observation_name=(recommendation.observation_name or "").strip(),
                    audit_object=[((group.name or "").strip() or "Не указан")[:255]],
                    manager=((group.manager or "").strip() or "Не указан")[:255],
                    deadline=deadline_to_iso(recommendation.deadline),
                )
            )

    if not items:
        return [], "В аудиторском заключении не найдены рекомендации для импорта."
    return items, None
