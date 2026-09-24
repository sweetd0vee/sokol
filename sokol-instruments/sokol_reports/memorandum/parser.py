# -*- coding: utf-8 -*-
"""Парсинг АЗ с Разделом II для генерации докладной записки."""

from __future__ import annotations

from typing import Optional, Tuple

from sokol_reports.dictionaries.validation import DictionaryRefError
from sokol_reports.memorandum.canonicalize import canonicalize_memorandum_source
from sokol_reports.memorandum.models import MemorandumSource
from sokol_reports.memorandum.section_ii_table_parser import (
    SECTION2_TABLE_HEADER,
    parse_section_ii_for_memorandum,
)
from sokol_reports.section_ii import xml_utils
from sokol_reports.section_ii.docx_blocks import load_document_xml
from sokol_reports.section_ii.patterns import W_NS

__all__ = [
    "MemorandumSource",
    "document_has_section_ii",
    "parse_az_for_memorandum",
]


def document_has_section_ii(file_path: str) -> bool:
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return False

    blocks = xml_utils.get_blocks_from_xml(body)
    for btype, el in blocks:
        if btype != "tbl":
            continue
        text = xml_utils.get_text_from_element(el)
        if SECTION2_TABLE_HEADER.lower() in text.lower():
            return True

    first_after_page2 = xml_utils.find_first_block_after_page2(body)
    section2 = xml_utils.find_section2_in_xml(body, min_idx=first_after_page2)
    if section2 is None:
        return False

    section2_idx = section2[0]
    for idx in range(section2_idx + 1, min(section2_idx + 6, len(blocks))):
        if blocks[idx][0] == "tbl":
            return True
    return False


def parse_az_for_memorandum(
    file_path: str,
    *,
    department_names: list[str] | None = None,
) -> Tuple[Optional[MemorandumSource], Optional[str]]:
    if not document_has_section_ii(file_path):
        return (
            None,
            "В документе не найден Раздел II. Загрузите АЗ с заполненным Разделом II.",
        )
    source, error = parse_section_ii_for_memorandum(file_path)
    if error or source is None:
        return source, error
    try:
        return canonicalize_memorandum_source(source, department_names=department_names), None
    except DictionaryRefError as exc:
        return None, str(exc)
