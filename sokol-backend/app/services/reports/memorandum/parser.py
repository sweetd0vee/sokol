# -*- coding: utf-8 -*-
"""Парсинг АЗ с Разделом II для генерации докладной записки."""

from typing import Optional, Tuple

from app.services.reports.memorandum.models import (
    MemorandumAuditObject,
    MemorandumRecommendation,
    MemorandumSource,
)
from app.services.reports.memorandum.section_ii_table_parser import (
    _append_to_groups,
    find_section_ii_table,
    parse_section_ii_for_memorandum,
)
from app.services.reports.section_ii import xml_utils
from app.services.reports.section_ii.docx_blocks import load_document_xml
from app.services.reports.section_ii.docx_parser import parse_observations_from_file_with_runs
from app.services.reports.section_ii.models import Observation
from app.services.reports.section_ii.patterns import W_NS

__all__ = [
    "document_has_section_ii",
    "parse_az_for_memorandum",
]

NO_SECTION_II_DETAIL = (
    "В документе не найден Раздел II. Загрузите АЗ с заполненным Разделом II "
    "или с наблюдениями в разделе III."
)
NO_RECOMMENDATIONS_DETAIL = (
    "Не удалось разобрать рекомендации: нет таблицы Раздела II и не найдены "
    "наблюдения в разделе III. Загрузите АЗ с наблюдениями или с заполненным Разделом II."
)


def document_has_section_ii(file_path: str) -> bool:
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return False

    if find_section_ii_table(body) is not None:
        return True

    blocks = xml_utils.get_blocks_from_xml(body)

    first_after_page2 = xml_utils.find_first_block_after_page2(body)
    section2 = xml_utils.find_section2_in_xml(body, min_idx=first_after_page2)
    if section2 is None:
        return False

    section2_idx, section2_end = section2
    for idx in range(section2_idx + 1, section2_end):
        if blocks[idx][0] == "tbl":
            return True
    return False


def _observation_recommendation_text(obs: Observation) -> str:
    if obs.rec_entries:
        joined = " ".join(entry.text for entry in obs.rec_entries if (entry.text or "").strip())
        if joined.strip():
            return " ".join(joined.split())
    return " ".join((obs.recommendations or "").split())


def memorandum_source_from_observations(observations: list[Observation]) -> Optional[MemorandumSource]:
    groups: list[MemorandumAuditObject] = []
    group_index: dict[str, int] = {}
    for obs in observations:
        rec_text = _observation_recommendation_text(obs)
        if not rec_text and not (obs.deadline or "").strip():
            continue
        recommendation = MemorandumRecommendation(
            paragraphs=[rec_text] if rec_text else [],
            deadline=(obs.deadline or "").strip(),
            observation_name=(obs.name or "").strip(),
        )
        _append_to_groups(
            groups,
            group_index,
            (obs.audit_object or "").strip() or "Не указан",
            (obs.manager or "").strip(),
            [recommendation],
        )
    if not groups:
        return None
    return MemorandumSource(groups=groups)


def parse_az_for_memorandum(file_path: str) -> Tuple[Optional[MemorandumSource], Optional[str]]:
    source, table_error = parse_section_ii_for_memorandum(file_path)
    if source is not None:
        return source, None

    observations = parse_observations_from_file_with_runs(file_path)
    fallback = memorandum_source_from_observations(observations)
    if fallback is not None:
        return fallback, None

    if table_error and "не найден" not in table_error.lower() and "не найдены" not in table_error.lower():
        return None, table_error
    if document_has_section_ii(file_path):
        return None, table_error or NO_RECOMMENDATIONS_DETAIL
    return None, NO_SECTION_II_DETAIL
