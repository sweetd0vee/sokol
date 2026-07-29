# -*- coding: utf-8 -*-
"""Закладки на наблюдения и имена якорей для гиперссылок из таблицы раздела II."""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Tuple

from app.services.reports.section_ii.bookmark_utils import extract_bookmark_names, next_bookmark_id
from app.services.reports.section_ii.patterns import OBS_START_RE, SECTION3_TOC_TEXT_RE

_SOKOL_OBS_BOOKMARK_PREFIX = "SokolObs"
_P_BLOCK_RE = re.compile(
    r"<(?P<qname>[\w:]+p)\b(?P<attrs>[^>]*)>(?P<body>.*?)</(?P=qname)>",
    re.IGNORECASE | re.DOTALL,
)
_PPR_CLOSE_RE = re.compile(r"</(?P<qname>[\w:]+pPr)>", re.IGNORECASE)
_TEXT_NODE_RE = re.compile(
    r"<(?P<tag>[\w:]+t)\b[^>]*>(?P<text>[^<]*)</(?P=tag)>",
    re.IGNORECASE,
)
_BOOKMARK_START_RE = re.compile(
    r"<(?P<tag>[\w:]+bookmarkStart)\b[^>]*\bw:name=\"(?P<name>[^\"]+)\"",
    re.IGNORECASE,
)
_SECTION3_MARK_RE = re.compile(
    r"(?:^|(?<=[\s>]))(?:III|Раздел\s+3)\s*[.)–—\-:]?",
    re.IGNORECASE,
)
_SECTION3_HEADING_RE = re.compile(
    r"^\s*(?:III|Раздел\s+3)\s*[.)–—\-:]?\s+(?!\d)\S|^\s*Раздел\s+3(?:[.\s]|$)",
    re.IGNORECASE,
)


def bookmark_name_for_observation(number: str) -> str:
    cleaned = re.sub(r"[^\d.]+", "", (number or "").strip())
    safe = cleaned.replace(".", "_") or "unknown"
    return f"{_SOKOL_OBS_BOOKMARK_PREFIX}{safe}"


def build_observation_anchor_map(observation_numbers: Iterable[str]) -> Dict[str, str]:
    return {
        number: bookmark_name_for_observation(number)
        for number in observation_numbers
        if number
    }


def _collect_text(xml_fragment: str) -> str:
    return "".join(match.group("text") for match in _TEXT_NODE_RE.finditer(xml_fragment))


def _element_text(el) -> str:
    return "".join(node.text or "" for node in el.iter() if hasattr(node, "text") and node.text)


def _existing_sokol_obs_bookmark(paragraph_xml: str, number: str) -> Optional[str]:
    expected = bookmark_name_for_observation(number)
    names = extract_bookmark_names(paragraph_xml)
    if expected in names:
        return expected
    return None


def _find_section3_search_start(document_xml: str) -> int:
    """Ищем текст раздела III, чтобы не ставить закладки в таблицу раздела II."""
    best = -1
    for match in _TEXT_NODE_RE.finditer(document_xml):
        text = match.group("text") or ""
        if not text.strip():
            continue
        if _SECTION3_MARK_RE.search(text) or SECTION3_TOC_TEXT_RE.search(text):
            # Берём последнее вхождение в body — обычно заголовок раздела III, не TOC.
            best = match.start()
    return best if best >= 0 else 0


def _find_search_start_from_blocks(
    needed: set[str],
    block_spans,
    blocks,
) -> Optional[int]:
    if not block_spans or not blocks or len(block_spans) != len(blocks):
        return None

    for idx, (btype, el) in enumerate(blocks):
        if btype != "p":
            continue
        text = _element_text(el).strip()
        if _SECTION3_HEADING_RE.match(text):
            return block_spans[idx][0]

    for idx, (_btype, el) in enumerate(blocks):
        text = _element_text(el)
        if not text:
            continue
        for obs_match in OBS_START_RE.finditer(text):
            if obs_match.group(1) in needed:
                return block_spans[idx][0]
    return None


def _inject_bookmark_into_paragraph_xml(paragraph_xml: str, name: str, bookmark_id: int) -> str:
    if any(match.group("name") == name for match in _BOOKMARK_START_RE.finditer(paragraph_xml)):
        return paragraph_xml

    open_match = re.match(r"<(?P<qname>[\w:]+p)\b[^>]*>", paragraph_xml, re.IGNORECASE)
    if not open_match:
        return paragraph_xml

    prefix = open_match.group("qname").split(":")[0] if ":" in open_match.group("qname") else "w"
    start_tag = f'<{prefix}:bookmarkStart w:id="{bookmark_id}" w:name="{name}"/>'
    end_tag = f'<{prefix}:bookmarkEnd w:id="{bookmark_id}"/>'

    ppr_close = _PPR_CLOSE_RE.search(paragraph_xml)
    insert_at = ppr_close.end() if ppr_close else open_match.end()
    close_idx = paragraph_xml.rfind("</")
    if insert_at <= 0 or close_idx <= insert_at:
        return paragraph_xml
    return (
        paragraph_xml[:insert_at]
        + start_tag
        + paragraph_xml[insert_at:close_idx]
        + end_tag
        + paragraph_xml[close_idx:]
    )


def ensure_observation_bookmarks(
    document_xml: str,
    observation_numbers: Iterable[str],
    bookmark_start_id: Optional[int] = None,
    block_spans=None,
    blocks=None,
) -> Tuple[str, Dict[str, str], int]:
    """
    Добавляет закладки на абзацы «Наблюдение X.Y» в разделе III
    и возвращает карту только для реально существующих закладок.
    """
    needed = {number for number in observation_numbers if number}
    next_id = bookmark_start_id if bookmark_start_id is not None else next_bookmark_id(document_xml)
    if not needed:
        return document_xml, {}, next_id

    search_from = _find_search_start_from_blocks(needed, block_spans, blocks)
    if search_from is None:
        search_from = _find_section3_search_start(document_xml)
    search_region = document_xml[search_from:]

    targets: List[Tuple[int, int, List[Tuple[str, str]]]] = []
    seen = set()
    for match in _P_BLOCK_RE.finditer(search_region):
        paragraph_xml = match.group(0)
        text = _collect_text(paragraph_xml)
        if not text:
            continue
        # Не ставим закладку на ячейки сводной таблицы раздела II.
        if "Основные нарушения" in text or "Существенность" in text:
            continue
        paragraph_bookmarks: List[Tuple[str, str]] = []
        for obs_match in OBS_START_RE.finditer(text):
            number = obs_match.group(1)
            if number not in needed or number in seen:
                continue
            seen.add(number)
            existing = _existing_sokol_obs_bookmark(paragraph_xml, number)
            bookmark_name = existing or bookmark_name_for_observation(number)
            paragraph_bookmarks.append((number, bookmark_name))
        if paragraph_bookmarks:
            absolute_start = search_from + match.start()
            absolute_end = search_from + match.end()
            targets.append((absolute_start, absolute_end, paragraph_bookmarks))

    updated = document_xml
    anchor_map: Dict[str, str] = {}

    for start, end, paragraph_bookmarks in sorted(targets, key=lambda item: item[0], reverse=True):
        paragraph_xml = updated[start:end]
        injected = paragraph_xml
        for number, bookmark_name in paragraph_bookmarks:
            existing = _existing_sokol_obs_bookmark(injected, number)
            if existing:
                anchor_map[number] = existing
                continue
            next_injected = _inject_bookmark_into_paragraph_xml(injected, bookmark_name, next_id)
            if next_injected == injected:
                continue
            if f'w:name="{bookmark_name}"' not in next_injected:
                continue
            injected = next_injected
            anchor_map[number] = bookmark_name
            next_id += 1
        updated = updated[:start] + injected + updated[end:]

    return updated, anchor_map, next_id
