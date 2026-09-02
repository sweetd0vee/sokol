# -*- coding: utf-8 -*-
"""Извлечение наименования проверки с титульного листа АЗ."""

import re
from typing import Iterable, List, Optional, Set, Tuple

from app.services.reports.section_ii import xml_utils
from app.services.reports.section_ii.docx_blocks import (
    get_cell_text,
    iter_txbx_contents,
    load_document_xml,
)
from app.services.reports.section_ii.patterns import W_NS

_TITLE_ARTIFACT_RE = re.compile(
    r"(?:"
    r"center\d+"
    r"|_Toc\d+"
    r"|StyleRef[^\s]*"
    r"|HYPERLINK[^\s]*"
    r"|\bPAGE\b"
    r"|\bNUMPAGES\b"
    r")",
    re.IGNORECASE,
)
_CITY_YEAR_LINE_RE = re.compile(
    r"^[А-Яа-яЁё][А-Яа-яЁё\-]*(?:\s+[А-Яа-яЁё][А-Яа-яЁё\-]*)*\s+\d{4}\.?$",
)
_DVA_FOOTER_LINE_RE = re.compile(
    r"^(?:"
    r"департамент\s+внутреннего(?:\s+аудита)?"
    r"|внутреннего\s+аудита"
    r"|аудита"
    r")\.?$",
    re.IGNORECASE,
)
_TRAILING_FOOTER_RE = re.compile(
    r"(?:"
    r"минск(?:\s+\d{4})?"
    r"|департамент\s+внутреннего(?:\s+аудита)?"
    r")+\s*$",
    re.IGNORECASE,
)


def _paragraph_visible_text(paragraph) -> str:
    parts = []
    for node in paragraph.iter(f"{{{W_NS}}}t"):
        if node.text:
            parts.append(node.text)
    return "".join(parts)


def _split_title_lines(text: str) -> List[str]:
    lines: List[str] = []
    for part in re.split(r"[\n\r\u2028\u2029]+", text or ""):
        normalized = re.sub(r"\s+", " ", part).strip()
        if normalized:
            lines.append(normalized)
    return lines


def _normalize_title_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    cleaned = _TITLE_ARTIFACT_RE.sub("", cleaned)
    cleaned = _TRAILING_FOOTER_RE.sub("", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip(" ,.;")


def _is_boilerplate_line(line: str) -> bool:
    normalized = re.sub(r"\s+", " ", (line or "").strip())
    if not normalized:
        return True

    lowered = normalized.lower().rstrip(".")
    if lowered in {"аудиторское", "заключение", "аудиторское заключение", "минск"}:
        return True
    if re.match(r"^аудиторск(?:ое|ого)\s+заключение\.?$", lowered):
        return True
    if _CITY_YEAR_LINE_RE.match(normalized):
        return True
    if _DVA_FOOTER_LINE_RE.match(lowered):
        return True
    if re.match(r"^банк\b", lowered):
        return True
    if re.match(r"^период\s+аудита", lowered):
        return True
    if re.match(r"^разделы\s+аудиторского", lowered):
        return True
    if re.match(r"^содержание\.?$", lowered):
        return True
    if re.fullmatch(r"\d{1,2}\.\d{2}\.\d{4}", normalized):
        return True
    if re.fullmatch(r"\d{4}\s*г\.?", normalized, flags=re.IGNORECASE):
        return True
    return False


def _lines_from_paragraph(paragraph) -> List[str]:
    text = _paragraph_visible_text(paragraph)
    if not text.strip():
        return []
    return _split_title_lines(text)


def _lines_from_textboxes(paragraph) -> List[str]:
    lines: List[str] = []
    for txbx in iter_txbx_contents(paragraph):
        for inner_paragraph in txbx.iter(f"{{{W_NS}}}p"):
            lines.extend(_lines_from_paragraph(inner_paragraph))
    return lines


def _lines_from_table(table) -> List[str]:
    lines: List[str] = []
    for tr in table.findall(f"./{{{W_NS}}}tr"):
        for tc in tr.findall(f"./{{{W_NS}}}tc"):
            cell_text = get_cell_text(tc)
            if cell_text.strip():
                lines.extend(_split_title_lines(cell_text))
    return lines


def _extend_unique_lines(lines: List[str], new_lines: Iterable[str]) -> None:
    seen: Set[str] = {line.casefold() for line in lines}
    for line in new_lines:
        key = line.casefold()
        if key in seen:
            continue
        seen.add(key)
        lines.append(line)


def _lines_from_paragraph_block(paragraph) -> List[str]:
    textbox_lines = _lines_from_textboxes(paragraph)
    if textbox_lines:
        return textbox_lines
    return _lines_from_paragraph(paragraph)


_TITLE_STOP_LINE_RE = re.compile(
    r"^(?:"
    r"содержание"
    r"|разделы\s+аудиторского"
    r"|(?:раздел\s+)?(?:iv|iii|ii|i|1|2|3)\s*[.)–—\-:]"
    r"|аудиторское\s+мнение"
    r")",
    re.IGNORECASE,
)


def _is_title_stop_line(line: str) -> bool:
    normalized = re.sub(r"\s+", " ", (line or "").strip())
    if not normalized:
        return False
    lowered = normalized.lower()
    if _TITLE_STOP_LINE_RE.match(lowered):
        return True
    return "основные нарушения и недостатки" in lowered


def _collect_title_page_lines(blocks: Iterable[tuple[str, object]]) -> List[str]:
    pages: List[List[str]] = [[]]
    stopped = False
    for btype, el in blocks:
        if btype == "p":
            new_lines = _lines_from_paragraph_block(el)
        elif btype == "tbl":
            new_lines = _lines_from_table(el)
        else:
            continue

        page = pages[-1]
        for line in new_lines:
            if _is_title_stop_line(line):
                stopped = True
                break
            _extend_unique_lines(page, [line])
        if stopped:
            break
        if btype == "p" and xml_utils._paragraph_has_page_break(el):
            if _build_check_name_from_lines(page):
                break
            pages.append([])

    for page in pages:
        if _build_check_name_from_lines(page):
            return page

    merged: List[str] = []
    for page in pages:
        _extend_unique_lines(merged, page)
    return merged


def _remove_immediate_repetition(text: str) -> str:
    normalized = _normalize_title_text(text)
    if not normalized:
        return normalized

    while True:
        length = len(normalized)
        half = length // 2
        if half >= 20 and normalized[:half] == normalized[half:]:
            normalized = normalized[:half]
            continue
        break

    for size in range(len(normalized) // 2, 19, -1):
        chunk = normalized[:size]
        repeat_at = normalized.find(chunk, 1)
        if repeat_at != -1 and repeat_at <= size + 2:
            return normalized[:repeat_at]

    return normalized


def _build_check_name_from_lines(lines: List[str]) -> Optional[str]:
    kept = [_normalize_title_text(line) for line in lines if not _is_boilerplate_line(line)]
    kept = [line for line in kept if line]
    if not kept:
        return None

    check_name = _remove_immediate_repetition(_normalize_title_text(" ".join(kept)))
    if len(re.findall(r"[А-Яа-яЁё]", check_name)) < 3:
        return None
    return check_name


def parse_az_title_from_docx(file_path: str) -> Tuple[str, Optional[str]]:
    """Вернуть наименование проверки с титульного листа АЗ."""
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return "", "Не удалось прочитать документ."

    lines = _collect_title_page_lines(xml_utils.get_blocks_from_xml(body))
    check_name = _build_check_name_from_lines(lines)
    if not check_name:
        return "", "Не удалось определить наименование проверки с титульного листа."

    return check_name, None
