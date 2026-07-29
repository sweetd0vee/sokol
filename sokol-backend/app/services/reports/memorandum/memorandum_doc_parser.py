# -*- coding: utf-8 -*-
"""Парсинг докладной записки (ДЗ) — «Приложение 2. Перечень аудиторских рекомендаций»."""

import re
from typing import List, Optional, Tuple

from docx import Document

from app.services.reports.memorandum.models import (
    MemorandumAuditObject,
    MemorandumRecommendation,
    MemorandumSource,
)
from app.services.reports.memorandum.section_ii_table_parser import _group_key, _normalize_deadline

RECOMMENDATIONS_TITLE = "Перечень аудиторских рекомендаций"
GROUP_HEADING_RE = re.compile(
    r"^([IVXLC]+)\.\s+(.+?)(?:\s+\(([^)]+)\))?:\s*$",
    re.IGNORECASE,
)
REC_NUMBER_RE = re.compile(r"^\d+\.\s*(.+)$", re.DOTALL)
DEADLINE_RE = re.compile(r"^Срок\s*[–\-—]\s*(.+)$", re.IGNORECASE)


def _normalize_paragraph_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\u00a0", " ")).strip()


def _append_to_groups(
    groups: List[MemorandumAuditObject],
    group_index: dict,
    audit_object: str,
    manager: str,
    recommendation: MemorandumRecommendation,
) -> None:
    if not recommendation.paragraphs and not recommendation.deadline:
        return

    key = _group_key(audit_object or "Без объекта аудита", manager)
    if key not in group_index:
        group_index[key] = len(groups)
        groups.append(
            MemorandumAuditObject(name=audit_object or "Без объекта аудита", manager=manager),
        )
    groups[group_index[key]].recommendations.append(recommendation)


def parse_recommendations_from_memorandum(file_path: str) -> Tuple[Optional[MemorandumSource], Optional[str]]:
    try:
        doc = Document(file_path)
    except Exception as exc:
        return None, f"Не удалось прочитать документ: {exc}"

    groups: List[MemorandumAuditObject] = []
    group_index: dict = {}
    current_audit_object = ""
    current_manager = ""
    current_paragraphs: List[str] = []
    current_deadline = ""
    in_recommendations_section = False

    def flush_recommendation() -> None:
        nonlocal current_paragraphs, current_deadline
        if not current_paragraphs and not current_deadline:
            return
        paragraphs = [re.sub(r"\s+", " ", p).strip() for p in current_paragraphs if p.strip()]
        _append_to_groups(
            groups,
            group_index,
            current_audit_object,
            current_manager,
            MemorandumRecommendation(paragraphs=paragraphs, deadline=current_deadline),
        )
        current_paragraphs = []
        current_deadline = ""

    for paragraph in doc.paragraphs:
        text = _normalize_paragraph_text(paragraph.text)
        if not text:
            continue

        if RECOMMENDATIONS_TITLE.lower() in text.lower():
            in_recommendations_section = True
            continue

        if not in_recommendations_section:
            continue

        if text.startswith("Приложение"):
            continue

        group_match = GROUP_HEADING_RE.match(text)
        if group_match:
            flush_recommendation()
            current_audit_object = group_match.group(2).strip()
            current_manager = (group_match.group(3) or "").strip().rstrip(".")
            continue

        rec_match = REC_NUMBER_RE.match(text)
        if rec_match:
            flush_recommendation()
            current_paragraphs = [rec_match.group(1).strip()]
            continue

        deadline_match = DEADLINE_RE.match(text)
        if deadline_match:
            current_deadline = _normalize_deadline(deadline_match.group(1))
            flush_recommendation()
            continue

        if current_paragraphs:
            current_paragraphs.append(text)

    flush_recommendation()

    if not groups:
        return None, (
            "В докладной записке не найдены рекомендации. "
            "Проверьте, что прикреплён файл ДЗ с разделом «Перечень аудиторских рекомендаций»."
        )

    return MemorandumSource(groups=groups), None
