"""Плоский парсинг строк Раздела II для файла контроля."""

from __future__ import annotations

from dataclasses import dataclass

from sokol_reports.control_file.responsible import format_responsible_from_pairs
from sokol_reports.memorandum.models import MemorandumRecommendation
from sokol_reports.memorandum.section_ii_table_parser import (
    cell_texts,
    find_section_ii_table,
    is_recommendation_row,
    parse_all_audit_object_pairs,
    parse_audit_object_header,
    split_body_into_recommendations,
)
from sokol_reports.section_ii.docx_blocks import load_document_xml
from sokol_reports.section_ii.patterns import SROK_TAIL_RE, W_NS


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
) -> tuple[list[ControlFileRow] | None, str | None]:
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return None, "Не удалось прочитать документ."

    table = find_section_ii_table(body)
    if table is None:
        return None, "Таблица Раздела II не найдена."

    rows: list[ControlFileRow] = []

    for tr in table.findall(f"./{{{W_NS}}}tr"):
        cells = cell_texts(tr)
        if not cells:
            continue

        first_cell = cells[0].strip()
        if not is_recommendation_row(first_cell):
            continue

        raw_recommendation = cells[1] if len(cells) > 1 else ""
        if not raw_recommendation.strip():
            continue

        pairs = parse_all_audit_object_pairs(raw_recommendation)
        if pairs:
            responsible = format_responsible_from_pairs(pairs)
        else:
            audit_object, manager, _ = parse_audit_object_header(raw_recommendation)
            responsible = format_responsible_from_pairs([(audit_object, manager)])

        _, _, body_text = parse_audit_object_header(raw_recommendation)
        recommendations = split_body_into_recommendations(body_text)
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
