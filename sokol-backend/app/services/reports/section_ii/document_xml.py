"""Low-level surgery of word/document.xml block spans."""

from __future__ import annotations

import re
from typing import Optional

import xml.etree.ElementTree as ET

from app.services.reports.ooxml import W_NS
from app.services.reports.section_ii import xml_utils


def create_page_break_paragraph() -> ET.Element:
    p = ET.Element(f"{{{W_NS}}}p")
    r = ET.SubElement(p, f"{{{W_NS}}}r")
    br = ET.SubElement(r, f"{{{W_NS}}}br")
    br.set(f"{{{W_NS}}}type", "page")
    return p


def serialize_fragment(el: ET.Element) -> str:
    return ET.tostring(el, encoding="unicode", method="xml")


def _tag_local_name(qname: str) -> str:
    return qname.split(":", 1)[-1]


def _find_matching_element_end(xml: str, start: int, qname: str) -> int:
    tag_re = re.compile(rf"<(?P<closing>/)?{re.escape(qname)}(?=[\s>/])[^>]*>")
    depth = 0
    for match in tag_re.finditer(xml, start):
        is_closing = bool(match.group("closing"))
        is_self_closing = match.group(0).rstrip().endswith("/>")
        if is_closing:
            depth -= 1
            if depth == 0:
                return match.end()
            continue
        if not is_self_closing:
            depth += 1
        if match.start() == start and is_self_closing:
            return match.end()
    raise ValueError(f"Не найден конец XML-элемента {qname}")


def find_body_block_spans(document_xml: str) -> list[tuple[int, int]]:
    body_match = re.search(r"<(?P<qname>[\w:]+:)?body(?=[\s>/])[^>]*>", document_xml)
    if not body_match:
        raise ValueError("Не найден w:body в document.xml")
    body_qname = (body_match.group("qname") or "") + "body"
    body_close = document_xml.find(f"</{body_qname}>", body_match.end())
    if body_close == -1:
        raise ValueError("Не найден закрывающий тег w:body в document.xml")

    spans: list[tuple[int, int]] = []
    tag_re = re.compile(r"<(?P<qname>[\w:]+)(?=[\s>/])[^>]*>")
    pos = body_match.end()
    while pos < body_close:
        match = tag_re.search(document_xml, pos, body_close)
        if not match:
            break
        qname = match.group("qname")
        local = _tag_local_name(qname)
        if local in xml_utils.XML_WRAPPER_TAGS:
            pos = match.end()
            continue
        end = _find_matching_element_end(document_xml, match.start(), qname)
        if local in {"p", "tbl"}:
            spans.append((match.start(), end))
        pos = end
    return spans


def replace_document_blocks_xml(
    original_xml: str,
    block_spans: list[tuple[int, int]],
    start_idx: int,
    end_idx: int,
    replacement_xml: str,
) -> str:
    if start_idx < 0 or start_idx > len(block_spans):
        raise ValueError("Некорректная точка вставки Раздела II")
    if end_idx < start_idx or end_idx > len(block_spans):
        raise ValueError("Некорректные границы Раздела II")

    if start_idx == len(block_spans):
        insert_at = block_spans[-1][1] if block_spans else original_xml.rfind("</w:body>")
        return original_xml[:insert_at] + replacement_xml + original_xml[insert_at:]

    replace_start = block_spans[start_idx][0]
    replace_end = block_spans[end_idx - 1][1] if end_idx > start_idx else replace_start
    return original_xml[:replace_start] + replacement_xml + original_xml[replace_end:]


def strip_generated_section2_blocks(document_xml: str, min_idx: int) -> str:
    """Удаляет ранее вставленный SOKOL-раздел II перед повторной генерацией."""
    updated = document_xml
    for _ in range(32):
        root = ET.fromstring(updated.encode("utf-8"))
        body = root.find(f".//{{{W_NS}}}body")
        if body is None:
            return updated
        blocks = xml_utils.get_blocks_from_xml(body)
        block_spans = find_body_block_spans(updated)
        if len(block_spans) != len(blocks):
            return updated
        ranges = xml_utils.find_generated_section2_block_ranges(body, min_idx=min_idx)
        if not ranges:
            return updated
        start_idx, end_idx = max(ranges, key=lambda item: item[0])
        updated = replace_document_blocks_xml(updated, block_spans, start_idx, end_idx, "")
    return updated


def validate_replacement_boundary(
    block_spans: list[tuple[int, int]],
    insert_idx: int,
    first_allowed_idx: int,
) -> Optional[str]:
    if insert_idx < first_allowed_idx:
        return (
            "Небезопасная точка вставки Раздела II: она находится в титульной "
            "странице/содержании. Документ не изменен."
        )
    if insert_idx <= 0:
        return "Небезопасная точка вставки Раздела II: начало документа. Документ не изменен."
    if insert_idx >= len(block_spans):
        return "Небезопасная точка вставки Раздела II: конец документа. Документ не изменен."
    return None


def validate_unchanged_prefix(
    original_xml: str,
    new_xml: str,
    block_spans: list[tuple[int, int]],
    insert_idx: int,
) -> Optional[str]:
    prefix_end = block_spans[insert_idx][0]
    if original_xml[:prefix_end] != new_xml[:prefix_end]:
        return (
            "Проверка защиты титульной страницы не пройдена: XML до Раздела II "
            "изменился. Документ не изменен."
        )
    return None
