# -*- coding: utf-8 -*-
"""Закладки на наблюдения и имена якорей для гиперссылок из таблицы раздела II."""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Tuple

from sokol_reports.section_ii.bookmark_utils import extract_bookmark_names, next_bookmark_id
from sokol_reports.section_ii.patterns import OBS_BLOCK_START_RE, OBS_START_RE, SECTION3_TOC_TEXT_RE
from sokol_reports.section_ii.xml_utils import is_sokol_summary_table_text

_SOKOL_OBS_BOOKMARK_PREFIX = "SokolObs"
_PPR_CLOSE_RE = re.compile(r"</(?P<qname>[\w:]+pPr)>", re.IGNORECASE)
_TEXT_NODE_RE = re.compile(
    r"<(?P<tag>[\w:]+t)\b[^>]*>(?P<text>[^<]*)</(?P=tag)>",
    re.IGNORECASE,
)
_TEXT_TOKEN_RE = re.compile(
    r"<(?P<tag>(?:[\w-]+:)?t)\b[^>]*>(?P<text>[^<]*)</(?P=tag)>"
    r"|<(?:[\w-]+:)?(?:tab|br|cr)\b[^>]*/?>",
    re.IGNORECASE,
)
_LOCAL_TAG_RE_CACHE: Dict[str, re.Pattern[str]] = {}
_PBDR_RE = re.compile(r"<(?:[\w-]+:)?pBdr\b", re.IGNORECASE)
_GAP_BLOCK_RE = re.compile(r"<(?:[\w-]+:)?(?:p|tbl)\b", re.IGNORECASE)
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


def _unescape_xml_text(value: str) -> str:
    return (
        value.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&apos;", "'")
    )


def _collect_text(xml_fragment: str) -> str:
    parts: List[str] = []
    for match in _TEXT_TOKEN_RE.finditer(xml_fragment):
        if match.group("text") is None:
            parts.append(" ")
            continue
        parts.append(_unescape_xml_text(match.group("text")))
    return "".join(parts)


def _normalize_match_text(value: str) -> str:
    text = (value or "").replace("\xa0", " ").replace("\u202f", " ")
    text = text.replace("ё", "е").replace("Ё", "е")
    text = text.replace("—", "-").replace("–", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip().casefold()


def _name_key(name: str) -> str:
    key = _normalize_match_text(name)
    key = re.sub(r"(?:\.{3}|…)+$", "", key)
    return key.strip(" .:-«»\"'")


def _is_title_frame(frame_text: str, number: str, name: str) -> bool:
    """Рамка заголовка содержит только номер и полное название наблюдения."""
    key = _name_key(name)
    if len(key) < 4:
        return False
    text = _normalize_match_text(frame_text)
    if key not in text:
        return False
    text = re.sub(
        rf"наблюдени[ея]\s*(?:№|n|no\.?)?\s*{re.escape(_normalize_match_text(number))}(?!\.\d)",
        " ",
        text,
        count=1,
    )
    idx = text.find(key)
    if idx < 0:
        return False
    remainder = f"{text[:idx]} {text[idx + len(key):]}"
    return re.sub(r"[^0-9a-zа-я]+", "", remainder) == ""


def _local_tag_re(local: str) -> re.Pattern[str]:
    cached = _LOCAL_TAG_RE_CACHE.get(local)
    if cached is None:
        cached = re.compile(
            rf"<(?P<slash>/)?(?P<qname>(?:[\w-]+:)?{re.escape(local)})(?=[\s>/])[^>]*>",
            re.IGNORECASE,
        )
        _LOCAL_TAG_RE_CACHE[local] = cached
    return cached


def _iter_local_spans(xml: str, local: str) -> List[Tuple[int, int]]:
    spans: List[Tuple[int, int]] = []
    stack: List[int] = []
    for match in _local_tag_re(local).finditer(xml):
        token = match.group(0)
        if match.group("slash"):
            if stack:
                spans.append((stack.pop(), match.end()))
            continue
        if token.rstrip().endswith("/>"):
            spans.append((match.start(), match.end()))
            continue
        stack.append(match.start())
    spans.sort()
    return spans


def _enclosing_span(spans: List[Tuple[int, int]], start: int, end: int) -> Optional[Tuple[int, int]]:
    found: Optional[Tuple[int, int]] = None
    for span_start, span_end in spans:
        if span_start <= start and end <= span_end:
            found = (span_start, span_end)
    return found


def _gap_has_block(xml: str, left_end: int, right_start: int) -> bool:
    return _GAP_BLOCK_RE.search(xml[left_end:right_start]) is not None


def _bordered_group_text(xml: str, records: List[dict], index: int) -> str:
    lo = index
    while lo > 0 and records[lo - 1]["border"] and not _gap_has_block(xml, records[lo - 1]["end"], records[lo]["start"]):
        lo -= 1
    hi = index
    limit = len(records) - 1
    while hi < limit and records[hi + 1]["border"] and not _gap_has_block(xml, records[hi]["end"], records[hi + 1]["start"]):
        hi += 1
    return " ".join(records[pos]["text"] for pos in range(lo, hi + 1))


def _next_paragraph_text(xml: str, records: List[dict], index: int) -> str:
    if index + 1 >= len(records):
        return ""
    if _gap_has_block(xml, records[index]["end"], records[index + 1]["start"]):
        return ""
    return records[index + 1]["text"]


def _candidate_priority(
    *,
    frame_kind: str,
    at_start: bool,
    rest: str,
    frame_text: str,
    next_text: str,
    number: str,
    name: str,
) -> Optional[int]:
    """Возвращает цель только для рамки, содержащей номер и название."""
    if (
        frame_kind in {"table", "border"}
        and at_start
        and _is_title_frame(frame_text, number, name)
    ):
        return 0
    return None


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
    observation_names: Optional[Dict[str, str]] = None,
) -> Tuple[str, Dict[str, str], int]:
    """
    Ставит закладку на рамку заголовка наблюдения: «Наблюдение X.Y» вместе с названием.

    Упоминание «Наблюдение X.Y» в тексте нарушения не подходит, даже если номер совпал.
    """
    needed = {number for number in observation_numbers if number}
    names = observation_names or {}
    next_id = bookmark_start_id if bookmark_start_id is not None else next_bookmark_id(document_xml)
    if not needed:
        return document_xml, {}, next_id

    search_from = _find_search_start_from_blocks(needed, block_spans, blocks)
    if search_from is None:
        search_from = _find_section3_search_start(document_xml)

    paragraph_spans = [
        span for span in _iter_local_spans(document_xml, "p") if span[0] >= search_from
    ]
    row_spans = _iter_local_spans(document_xml, "tr")
    records: List[dict] = []
    for start, end in paragraph_spans:
        paragraph_xml = document_xml[start:end]
        text = _collect_text(paragraph_xml).strip()
        border = _PBDR_RE.search(paragraph_xml) is not None
        if not text and not border:
            continue
        records.append(
            {
                "start": start,
                "end": end,
                "text": text,
                "border": border,
            }
        )

    chosen: Dict[str, Tuple[int, int, int]] = {}

    def consider(number: str, priority: int, start: int, end: int) -> None:
        if number not in needed:
            return
        current = chosen.get(number)
        if current is None or (priority, start) < (current[0], current[1]):
            chosen[number] = (priority, start, end)

    for index, record in enumerate(records):
        text = record["text"]
        row = _enclosing_span(row_spans, record["start"], record["end"])
        if row is not None:
            frame_kind = "table"
            frame_text = _collect_text(document_xml[row[0]:row[1]])
        elif record["border"]:
            frame_kind = "border"
            frame_text = _bordered_group_text(document_xml, records, index)
        else:
            frame_kind = "plain"
            frame_text = text
        if is_sokol_summary_table_text(frame_text):
            continue
        if "Основные нарушения" in text or "Существенность" in text:
            continue

        next_text = _next_paragraph_text(document_xml, records, index)
        start_match = OBS_BLOCK_START_RE.match(text)
        matches = []
        if start_match:
            matches.append(start_match)
        for mid_match in OBS_START_RE.finditer(text):
            if start_match and mid_match.start() <= start_match.start():
                continue
            matches.append(mid_match)

        for obs_match in matches:
            number = obs_match.group(1)
            if number not in needed:
                continue
            at_start = start_match is not None and obs_match.start() == start_match.start()
            priority = _candidate_priority(
                frame_kind=frame_kind,
                at_start=at_start,
                rest=text[obs_match.end():],
                frame_text=frame_text,
                next_text=next_text,
                number=number,
                name=(names.get(number) or "").strip(),
            )
            if priority is None:
                continue
            consider(number, priority, record["start"], record["end"])

    grouped: Dict[Tuple[int, int], List[Tuple[str, str]]] = {}
    for number, (_priority, start, end) in chosen.items():
        paragraph_xml = document_xml[start:end]
        existing = _existing_sokol_obs_bookmark(paragraph_xml, number)
        bookmark_name = existing or bookmark_name_for_observation(number)
        grouped.setdefault((start, end), []).append((number, bookmark_name))

    targets = [
        (start, end, bookmarks)
        for (start, end), bookmarks in grouped.items()
    ]

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
