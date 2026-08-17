# -*- coding: utf-8 -*-
"""Извлечение наименования проверки с титульного листа АЗ."""

import re
from typing import Optional, Tuple

from sokol_reports.section_ii import xml_utils
from sokol_reports.section_ii.docx_blocks import load_document_xml
from sokol_reports.section_ii.patterns import W_NS

_TITLE_PAGE_SKIP_RE = re.compile(
    r"^(?:"
    r"аудиторск(?:ое|ого)\s+заключение"
    r"|банк\b"
    r"|период\s+аудита"
    r"|разделы\s+аудиторского"
    r"|содержание"
    r"|\d{1,2}\.\d{2}\.\d{4}"
    r"|\d{4}\s*г\.?"
    r")",
    re.IGNORECASE,
)


def parse_az_title_from_docx(file_path: str) -> Tuple[str, Optional[str]]:
    """Вернуть наименование проверки с титульного листа АЗ."""
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return "", "Не удалось прочитать документ."

    candidates: list[str] = []
    for btype, el in xml_utils.get_blocks_from_xml(body):
        if btype != "p":
            continue

        text = re.sub(r"\s+", " ", xml_utils.get_text_from_element(el).strip())
        if text and len(text) > 2 and not _TITLE_PAGE_SKIP_RE.match(text):
            candidates.append(text)

        if xml_utils._paragraph_has_page_break(el):
            break

    if not candidates:
        return "", "Не удалось определить наименование проверки с титульного листа."

    return candidates[0], None
