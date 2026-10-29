# -*- coding: utf-8 -*-
"""Парсинг таблицы Раздела II АЗ для докладной записки."""

import re
from typing import List, Optional, Tuple

from app.services.reports.ooxml import local_tag
from app.services.reports.memorandum.models import (
    MemorandumAuditObject,
    MemorandumRecommendation,
    MemorandumSource,
)
from app.services.reports.section_ii import xml_utils
from app.services.reports.section_ii.docx_blocks import get_cell_text, load_document_xml
from app.services.reports.section_ii.field_parser import int_to_roman
from app.services.reports.section_ii.patterns import (
    COMPLETED_DURING_AUDIT_PATTERN,
    OBS_START_RE,
    SROK_TAIL_RE,
    W_NS,
)

__all__ = [
    "cell_texts",
    "find_section_ii_table",
    "format_group_heading",
    "is_recommendation_row",
    "parse_all_audit_object_pairs",
    "parse_audit_object_header",
    "parse_section_ii_for_memorandum",
    "split_body_into_recommendations",
]

SECTION2_TABLE_HEADER = "Основные нарушения и недостатки"
REC_ROW_LABEL_RE = re.compile(r"^(?:Рекомендация|Аудиторск\w*\s+рекомендац\w*)", re.IGNORECASE)
OBS_ROW_LABEL_RE = re.compile(r"^Наблюдени", re.IGNORECASE)
CHAPTER_ROW_RE = re.compile(r"^(?:Раздел|Глава)\s+", re.IGNORECASE)
AUDIT_OBJECT_RE = re.compile(
    r"Объект\s+аудита:\s*(.+?)\s*Руководитель\s+объекта\s+аудита:\s*",
    re.IGNORECASE | re.DOTALL,
)
PERSON_INITIALS_RE = r"[А-ЯЁA-Z][а-яёa-z]+\s+[А-ЯЁA-Z]\.\s*[А-ЯЁA-Z]\.?"
MANAGER_RE = re.compile(
    rf"^((?:{PERSON_INITIALS_RE})(?:\s*,\s*{PERSON_INITIALS_RE})*)\.?",
)
DEADLINE_VALUE_RE = re.compile(
    rf"(\d{{1,2}}\.\d{{2}}\.\d{{4}}|на\s+постоянной\s+основе\.?|постоянно\.?|{COMPLETED_DURING_AUDIT_PATTERN})",
    re.IGNORECASE,
)
SROK_INLINE_RE = re.compile(r"Срок\s*[–\-—]\s*", re.IGNORECASE)
OBSERVATION_PREFIX_RE = re.compile(
    r"^Наблюдени[ея]?\s*(?:№?\s*\d+|[IVXLC]+)?\s*[:.)\-–—]*\s*",
    re.IGNORECASE,
)


_ROW_WRAPPER_TAGS = frozenset({"sdt", "sdtContent", "customXml", "smartTag", "ins", "del"})


def _iter_wrapped(el, target_tag: str) -> List[object]:
    found: List[object] = []

    def walk(node) -> None:
        for child in node:
            tag = local_tag(child)
            if tag == target_tag:
                found.append(child)
            elif tag == "tbl":
                continue
            elif tag in _ROW_WRAPPER_TAGS:
                walk(child)

    walk(el)
    return found


def _table_rows(table) -> List[object]:
    return _iter_wrapped(table, "tr")


def _cell_texts(tr) -> List[str]:
    return [get_cell_text(tc).strip() for tc in _iter_wrapped(tr, "tc")]


def _is_section2_header_row(cells: List[str]) -> bool:
    joined = " ".join(cell for cell in cells if cell.strip())
    if SECTION2_TABLE_HEADER.lower() in joined.lower():
        return True
    if xml_utils.is_sokol_summary_table_text(joined) and not any(
        REC_ROW_LABEL_RE.match(cell.strip()) for cell in cells if cell.strip()
    ):
        return True
    return False


def _find_section_ii_table(body) -> Optional[object]:
    header = SECTION2_TABLE_HEADER.lower()
    header_match = None
    summary_match = None
    for el in body.iter(f"{{{W_NS}}}tbl"):
        text = xml_utils.get_text_from_element(el)
        lowered = text.lower()
        if header in lowered:
            header_match = el
            break
        if summary_match is None and xml_utils.is_sokol_summary_table_text(text):
            summary_match = el
    return header_match if header_match is not None else summary_match


def _parse_audit_object_header(raw_text: str) -> Tuple[str, str, str]:
    text = re.sub(r"\s+", " ", (raw_text or "").strip())
    match = AUDIT_OBJECT_RE.search(text)
    if not match:
        return "", "", text

    audit_object = re.sub(r"\s+", " ", match.group(1).strip())
    tail = text[match.end() :].strip()
    manager_match = MANAGER_RE.match(tail)
    if not manager_match:
        return audit_object, "", tail

    manager = re.sub(r"\s+", " ", manager_match.group(1).strip().rstrip("."))
    body = tail[manager_match.end() :].strip()
    return audit_object, manager, body


def _normalize_deadline(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip()).rstrip(".")
    return cleaned


def _extract_observation_name(cells: List[str]) -> str:
    raw = " ".join(cell for cell in cells[1:] if cell.strip()).strip()
    if not raw:
        raw = cells[0].strip() if cells else ""
    cleaned = re.sub(r"\s+", " ", raw)
    without_prefix = OBSERVATION_PREFIX_RE.sub("", cleaned).strip()
    return without_prefix or cleaned


def _extract_deadline_and_rest(chunk: str) -> Tuple[str, str]:
    chunk = chunk.strip()
    if not chunk:
        return "", ""

    date_match = DEADLINE_VALUE_RE.match(chunk)
    if date_match:
        deadline = _normalize_deadline(date_match.group(1))
        rest = chunk[date_match.end() :].strip()
        return deadline, rest

    next_srok = SROK_INLINE_RE.search(chunk)
    if next_srok:
        return _normalize_deadline(chunk[: next_srok.start()]), chunk[next_srok.start() :]

    return _normalize_deadline(chunk), ""


def _split_body_into_recommendations(body: str) -> List[MemorandumRecommendation]:
    body = (body or "").strip()
    if not body:
        return []

    items: List[MemorandumRecommendation] = []
    pos = 0
    pending_text = ""

    while pos < len(body):
        srok_match = SROK_INLINE_RE.search(body, pos)
        if not srok_match:
            tail = body[pos:].strip()
            if tail:
                if items:
                    items[-1].paragraphs.append(tail)
                elif pending_text:
                    items.append(MemorandumRecommendation(paragraphs=[pending_text, tail]))
                else:
                    items.append(MemorandumRecommendation(paragraphs=[tail]))
            elif pending_text:
                items.append(MemorandumRecommendation(paragraphs=[pending_text]))
            break

        text_part = body[pos : srok_match.start()].strip()
        if text_part:
            pending_text = f"{pending_text} {text_part}".strip() if pending_text else text_part

        pos = srok_match.end()
        deadline, rest = _extract_deadline_and_rest(body[pos:])
        pos = len(body) - len(rest) if rest else len(body)

        if pending_text or deadline:
            if not pending_text and deadline and items:
                items[-1].paragraphs.append(f"Срок – {deadline}")
            else:
                items.append(
                    MemorandumRecommendation(
                        paragraphs=[pending_text] if pending_text else [],
                        deadline=deadline,
                    )
                )
            if rest and not SROK_INLINE_RE.match(rest):
                pending_text = rest
            else:
                pending_text = ""
        elif rest:
            pending_text = rest if not SROK_INLINE_RE.match(rest) else ""

    for item in items:
        item.paragraphs = [re.sub(r"\s+", " ", p).strip() for p in item.paragraphs if p.strip()]
    return [item for item in items if item.paragraphs or item.deadline]


def _group_key(name: str, manager: str) -> str:
    return f"{name.strip().lower()}|{manager.strip().lower()}"


def _append_to_groups(
    groups: List[MemorandumAuditObject],
    group_index: dict,
    audit_object: str,
    manager: str,
    recommendations: List[MemorandumRecommendation],
) -> None:
    if not audit_object and not recommendations:
        return

    key = _group_key(audit_object or "Без объекта аудита", manager)
    if key not in group_index:
        group_index[key] = len(groups)
        groups.append(MemorandumAuditObject(name=audit_object or "Без объекта аудита", manager=manager))
    groups[group_index[key]].recommendations.extend(recommendations)


def parse_section_ii_for_memorandum(file_path: str) -> Tuple[Optional[MemorandumSource], Optional[str]]:
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return None, "Не удалось прочитать документ."

    table = _find_section_ii_table(body)
    if table is None:
        return None, "Таблица Раздела II не найдена."

    groups: List[MemorandumAuditObject] = []
    group_index: dict = {}
    current_observation_name = ""

    for tr in _table_rows(table):
        cells = _cell_texts(tr)
        if not cells:
            continue

        first_cell = cells[0].strip()
        if _is_section2_header_row(cells):
            continue
        if CHAPTER_ROW_RE.match(first_cell):
            continue
        if OBS_ROW_LABEL_RE.match(first_cell):
            current_observation_name = _extract_observation_name(cells)
            continue
        if OBS_START_RE.search(first_cell) and not REC_ROW_LABEL_RE.match(first_cell):
            current_observation_name = _extract_observation_name(cells)
            continue
        if not REC_ROW_LABEL_RE.match(first_cell):
            continue

        raw_recommendation = cells[1] if len(cells) > 1 else ""
        if not raw_recommendation.strip():
            continue

        audit_object, manager, body_text = _parse_audit_object_header(raw_recommendation)
        recommendations = _split_body_into_recommendations(body_text)
        if not recommendations and body_text:
            clean_body = SROK_TAIL_RE.sub("", body_text).strip()
            deadline_match = SROK_TAIL_RE.search(body_text)
            deadline = _normalize_deadline(deadline_match.group(0).split("–", 1)[-1]) if deadline_match else ""
            recommendations = [MemorandumRecommendation(paragraphs=[clean_body], deadline=deadline)]
        for recommendation in recommendations:
            recommendation.observation_name = current_observation_name

        _append_to_groups(groups, group_index, audit_object, manager, recommendations)

    if not groups:
        return None, "В Разделе II аудиторского заключения не найдены рекомендации для импорта."

    return MemorandumSource(groups=groups), None


def format_group_heading(index: int, group: MemorandumAuditObject) -> str:
    roman = int_to_roman(index)
    manager = group.manager.strip()
    if manager and not manager.endswith("."):
        manager = f"{manager}."
    manager_suffix = f" ({manager})" if manager else ""
    return f"{roman}. {group.name}{manager_suffix}:"


def parse_all_audit_object_pairs(raw_text: str) -> List[Tuple[str, str]]:
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


def is_recommendation_row(first_cell: str) -> bool:
    if SECTION2_TABLE_HEADER.lower() in first_cell.lower():
        return False
    if CHAPTER_ROW_RE.match(first_cell) or OBS_ROW_LABEL_RE.match(first_cell):
        return False
    if OBS_START_RE.search(first_cell) and not REC_ROW_LABEL_RE.match(first_cell):
        return False
    return REC_ROW_LABEL_RE.match(first_cell) is not None


# Public names match sokol-instruments; private aliases stay for existing imports.
cell_texts = _cell_texts
find_section_ii_table = _find_section_ii_table
parse_audit_object_header = _parse_audit_object_header
split_body_into_recommendations = _split_body_into_recommendations
_parse_all_audit_object_pairs = parse_all_audit_object_pairs
_is_recommendation_row = is_recommendation_row
