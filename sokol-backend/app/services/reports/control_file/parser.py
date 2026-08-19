# -*- coding: utf-8 -*-
"""Плоский парсинг строк Раздела II для файла контроля."""

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from app.services.reports.memorandum.models import MemorandumRecommendation
from app.services.reports.memorandum.section_ii_table_parser import (
    CHAPTER_ROW_RE,
    OBS_ROW_LABEL_RE,
    REC_ROW_LABEL_RE,
    SECTION2_TABLE_HEADER,
    _cell_texts,
    _find_section_ii_table,
    _parse_audit_object_header,
    _split_body_into_recommendations,
)
from app.services.reports.section_ii.docx_blocks import load_document_xml
from app.services.reports.section_ii.field_parser import SROK_TAIL_RE
from app.services.reports.section_ii.patterns import OBS_START_RE, W_NS

PERSON_INITIALS_RE = r"[А-ЯЁA-Z][а-яёa-z]+\s+[А-ЯЁA-Z]\.\s*[А-ЯЁA-Z]\.?"


def _parse_all_audit_object_pairs(raw_text: str) -> List[Tuple[str, str]]:
    text = re.sub(r"\s+", " ", (raw_text or "").strip())
    pairs: List[Tuple[str, str]] = []
    pattern = re.compile(
        rf"Объект\s+аудита:\s*(.+?)\s*Руководитель\s+объекта\s+аудита:\s*"
        rf"({PERSON_INITIALS_RE}(?:\s*,\s*{PERSON_INITIALS_RE})*)",
        re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(text):
        audit_object = re.sub(r"\s+", " ", match.group(1).strip())
        manager = re.sub(r"\s+", " ", match.group(2).strip().rstrip("."))
        if audit_object or manager:
            pairs.append((audit_object, manager))
    return pairs


@dataclass
class ControlFileRow:
    recommendation_text: str
    deadline: str
    responsible: str


def _recommendation_to_text(recommendation: MemorandumRecommendation) -> str:
    parts = [part.strip() for part in recommendation.paragraphs if part.strip()]
    return " ".join(parts)


def parse_section_ii_for_control_file(
    file_path: str,
    *,
    format_responsible_from_pairs,
) -> Tuple[Optional[List[ControlFileRow]], Optional[str]]:
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return None, "Не удалось прочитать документ."

    table = _find_section_ii_table(body)
    if table is None:
        return None, "Таблица Раздела II не найдена."

    rows: List[ControlFileRow] = []

    for tr in table.findall(f"./{{{W_NS}}}tr"):
        cells = _cell_texts(tr)
        if not cells:
            continue

        first_cell = cells[0].strip()
        if SECTION2_TABLE_HEADER.lower() in first_cell.lower():
            continue
        if CHAPTER_ROW_RE.match(first_cell) or OBS_ROW_LABEL_RE.match(first_cell):
            continue
        if OBS_START_RE.search(first_cell) and not REC_ROW_LABEL_RE.match(first_cell):
            continue
        if not REC_ROW_LABEL_RE.match(first_cell):
            continue

        raw_recommendation = cells[1] if len(cells) > 1 else ""
        if not raw_recommendation.strip():
            continue

        pairs = _parse_all_audit_object_pairs(raw_recommendation)
        if pairs:
            responsible = format_responsible_from_pairs(pairs)
        else:
            audit_object, manager, _ = _parse_audit_object_header(raw_recommendation)
            responsible = format_responsible_from_pairs([(audit_object, manager)])

        _, _, body_text = _parse_audit_object_header(raw_recommendation)
        recommendations = _split_body_into_recommendations(body_text)
        if not recommendations and body_text:
            clean_body = SROK_TAIL_RE.sub("", body_text).strip()
            deadline_match = SROK_TAIL_RE.search(body_text)
            deadline = (
                deadline_match.group(0).split("–", 1)[-1].strip().rstrip(".")
                if deadline_match
                else ""
            )
            recommendations = [MemorandumRecommendation(paragraphs=[clean_body], deadline=deadline)]

        for recommendation in recommendations:
            rows.append(
                ControlFileRow(
                    recommendation_text=_recommendation_to_text(recommendation),
                    deadline=(recommendation.deadline or "").strip(),
                    responsible=responsible,
                )
            )

    if not rows:
        return None, "В Разделе II аудиторского заключения не найдены рекомендации для импорта."

    return rows, None
