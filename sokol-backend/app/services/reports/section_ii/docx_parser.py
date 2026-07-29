# -*- coding: utf-8 -*-
"""
Парсер аудиторских заключений для извлечения наблюдений из раздела 3.
"""

import copy
import re
from typing import List, Optional, Tuple

import xml.etree.ElementTree as ET

from app.services.reports.section_ii import xml_utils
from app.services.reports.section_ii.docx_blocks import (
    DocumentBlock,
    clone_runs,
    extract_document_blocks,
    extract_name_runs_from_tables,
    get_text_from_xml as get_text_from_xml_blocks,
    load_document_xml,
    runs_to_text,
)
from app.services.reports.section_ii.field_parser import (
    extract_deadline_from_text,
    extract_materiality_from_text,
    extract_rec_label,
    parse_text_observations,
)
from app.services.reports.section_ii.heading_detection import (
    build_block_heading_state,
    find_section3_flat_block_idx,
    find_sokol_summary_block_indices,
)
from app.services.reports.section_ii.models import (
    Observation,
    RecommendationEntry,
    RunFragment,
)
from app.services.reports.section_ii.patterns import (
    AUDIT_REC_LABEL_RE,
    OBS_BLOCK_START_RE,
    OBS_START_RE,
    REC_LABEL_RE,
    SROK_MARK_RE,
    W_NS,
)
XML_NS = "http://www.w3.org/XML/1998/namespace"

SECTION3_BLOCK_RE = re.compile(
    r"^\s*(?:III|3)\s*[.)–—\-:]?\s+\S|^\s*Раздел\s+3[.\s]",
    re.IGNORECASE,
)
STRUCTURED_REC_LABEL_RE = re.compile(
    r"(?:^|\n)\s*(?:Аудиторск\w*\s+рекомендац\w*|Рекомендаци[яи]|Мероприятия\s+после\s+аудита)\s*[:—–\-]",
    re.IGNORECASE,
)
OBJECT_AUDIT_RE = re.compile(r"(?:^|\n)\s*Объект\s+аудита\s*[:—–\-]", re.IGNORECASE)
OBJECT_HEAD_RE = re.compile(
    r"(?:^|\n)\s*Руководител[ья]\s+объекта\s+аудита\s*[:—–\-]",
    re.IGNORECASE,
)


def get_document_text(doc) -> str:
    """Извлекает весь текст из документа (параграфы + таблицы) — ВСЕ наблюдения."""
    parts = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            parts.append(text)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                text = cell.text.strip()
                if text:
                    parts.append(text)
    return "\n".join(parts)


def parse_observations(text: str) -> List[Observation]:
    """
    Парсит наблюдения из текста раздела 3.

    Извлекает:
    - Номер главы (Глава 3, Раздел 3)
    - Номер наблюдения (3.1, 4.1.1)
    - Название наблюдения
    - Уровень существенности (низкий/средний/высокий)
    - Аудиторская рекомендация (полный текст)
    - Срок (Срок – DD.MM.YYYY)
    """
    return parse_text_observations(text)


def parse_observations_from_doc(doc) -> List[Observation]:
    """Парсит наблюдения из документа python-docx."""
    text = get_document_text(doc)
    return parse_observations(text)


def get_text_from_xml(root) -> str:
    """Compatibility wrapper for callers that still import from docx_parser."""
    return get_text_from_xml_blocks(root)


def _find_section3_flat_block_idx(blocks, min_block_idx: int = 0) -> int:
    return find_section3_flat_block_idx(blocks, min_block_idx=min_block_idx)


def _run_has_payload(r: ET.Element) -> bool:
    for child in list(r):
        if child.tag != f"{{{W_NS}}}rPr":
            return True
    return False


def _raw_run_is_break_only(r: ET.Element) -> bool:
    has_break = False
    for child in list(r):
        tag = child.tag
        if tag == f"{{{W_NS}}}rPr":
            continue
        if tag in (f"{{{W_NS}}}br", f"{{{W_NS}}}cr"):
            has_break = True
            continue
        return False
    return has_break


def _strip_leading_breaks(runs: List[RunFragment]) -> List[RunFragment]:
    result = list(runs)
    while result:
        frag = result[0]
        if frag.br_before:
            frag.br_before = False
        if frag.raw_r is not None:
            if _raw_run_is_break_only(frag.raw_r) and frag.text in ("", "\n"):
                result.pop(0)
                continue
            break
        if frag.text.startswith("\n"):
            frag.text = frag.text.lstrip("\n")
            if frag.text == "" and not frag.is_tab:
                result.pop(0)
                continue
        break
    return result


def _split_runs_by_offset(runs: List[RunFragment], offset: int) -> List[RunFragment]:
    return _slice_runs_by_offsets(runs, offset)


def _truncate_runs_to_offset(runs: List[RunFragment], offset: int) -> List[RunFragment]:
    return _slice_runs_by_offsets(runs, 0, offset)


def _runs_to_text(runs: List[RunFragment]) -> str:
    parts: List[str] = []
    for frag in runs:
        if frag.br_before:
            parts.append("\n")
        parts.append(frag.text or "")
    return "".join(parts)


def _runs_to_text_no_breaks(runs: List[RunFragment]) -> str:
    parts: List[str] = []
    for frag in runs:
        parts.append(frag.text or "")
    return "".join(parts)


def _clone_fragment_with_text(frag: RunFragment, text: str, br_before: bool) -> RunFragment:
    return RunFragment(
        text=text,
        rPr=copy.deepcopy(frag.rPr) if frag.rPr is not None else None,
        br_before=br_before,
        is_tab=frag.is_tab,
        raw_r=None,
    )


def _text_nodes(raw_r: ET.Element) -> List[ET.Element]:
    return [
        node
        for node in raw_r.iter()
        if node.tag in (f"{{{W_NS}}}t", f"{{{W_NS}}}instrText")
    ]


def _raw_run_text(raw_r: ET.Element) -> str:
    return "".join(node.text or "" for node in _text_nodes(raw_r))


def _preserve_raw_text_spaces(raw_r: ET.Element) -> ET.Element:
    for node in raw_r.iter(f"{{{W_NS}}}t"):
        text = node.text or ""
        if text and (text[0].isspace() or text[-1].isspace()):
            node.set(f"{{{XML_NS}}}space", "preserve")
    return raw_r


def _slice_raw_run_text(raw_r: ET.Element, start: int, end: int) -> Optional[ET.Element]:
    raw_text = _raw_run_text(raw_r)
    if end <= start:
        return None
    if start == 0 and end == len(raw_text):
        return _preserve_raw_text_spaces(copy.deepcopy(raw_r))
    if len(raw_text) == 0:
        return None

    cloned = copy.deepcopy(raw_r)
    pos = 0
    kept_any = False
    for node in _text_nodes(cloned):
        text = node.text or ""
        node_start = pos
        node_end = pos + len(text)
        keep_start = max(start, node_start)
        keep_end = min(end, node_end)
        if keep_start < keep_end:
            node.text = text[keep_start - node_start : keep_end - node_start]
            kept_any = True
        else:
            node.text = ""
        pos = node_end
    if not kept_any:
        return None
    return _preserve_raw_text_spaces(cloned)


def _copy_fragment_slice(
    frag: RunFragment,
    start: int,
    end: int,
    br_before: bool,
) -> Optional[RunFragment]:
    text = frag.text or ""
    if end <= start:
        return None
    sliced_text = text[start:end]
    if not sliced_text and not frag.is_tab:
        return None

    raw_r = None
    if frag.raw_r is not None and _raw_run_text(frag.raw_r) == text:
        raw_r = _slice_raw_run_text(frag.raw_r, start, end)

    return RunFragment(
        text=sliced_text,
        rPr=copy.deepcopy(frag.rPr) if frag.rPr is not None else None,
        br_before=br_before,
        is_tab=frag.is_tab,
        raw_r=raw_r,
    )


def _spans_overlap(start: int, end: int, spans: List[Tuple[int, int]]) -> bool:
    return any(start < span_end and end > span_start for span_start, span_end in spans)


def _position_removed(pos: int, spans: List[Tuple[int, int]]) -> bool:
    return any(span_start <= pos < span_end for span_start, span_end in spans)


def _slice_runs_by_offsets(
    runs: List[RunFragment],
    start_offset: int,
    end_offset: Optional[int] = None,
) -> List[RunFragment]:
    text_len = len(_runs_to_text(runs))
    start_offset = max(0, start_offset)
    end_offset = text_len if end_offset is None else min(text_len, max(start_offset, end_offset))
    remove_spans = [(0, start_offset), (end_offset, text_len)]
    return _remove_text_spans_from_runs(runs, remove_spans)


def _runs_to_chars(runs: List[RunFragment]) -> List[Tuple[RunFragment, str, bool]]:
    chars: List[Tuple[RunFragment, str, bool]] = []
    for frag in runs:
        if frag.br_before:
            chars.append((frag, "\n", True))
        text = frag.text or ""
        if frag.is_tab and text == "":
            chars.append((frag, "\t", False))
            continue
        for ch in text:
            chars.append((frag, ch, False))
    return chars


def _runs_from_chars(chars: List[Tuple[RunFragment, str, bool]]) -> List[RunFragment]:
    result: List[RunFragment] = []
    pending_break = False
    current_source: Optional[RunFragment] = None
    for frag, ch, is_break_marker in chars:
        if is_break_marker:
            pending_break = True
            continue
        if not result:
            result.append(_clone_fragment_with_text(frag, ch, pending_break))
            current_source = frag
            pending_break = False
            continue
        prev = result[-1]
        same_style = current_source is frag and prev.is_tab == frag.is_tab and not pending_break
        if same_style:
            prev.text = (prev.text or "") + ch
        else:
            result.append(_clone_fragment_with_text(frag, ch, pending_break))
            current_source = frag
            pending_break = False
    return result


def _remove_text_spans_from_runs(
    runs: List[RunFragment],
    spans: List[Tuple[int, int]],
) -> List[RunFragment]:
    if not spans:
        return clone_runs(runs)

    normalized_spans = sorted(
        (max(0, start), max(0, end))
        for start, end in spans
        if end > start
    )
    result: List[RunFragment] = []
    pos = 0
    for frag in runs:
        break_kept = False
        if frag.br_before:
            break_kept = not _position_removed(pos, normalized_spans)
            pos += 1

        text = frag.text or ""
        text_start = pos
        text_end = text_start + len(text)
        if text and not _spans_overlap(text_start, text_end, normalized_spans):
            copied = _copy_fragment_slice(frag, 0, len(text), break_kept)
            if copied is not None:
                result.append(copied)
        elif text:
            cursor = text_start
            first_slice = True
            for span_start, span_end in normalized_spans:
                if span_end <= cursor:
                    continue
                if span_start >= text_end:
                    break
                keep_start = cursor
                keep_end = min(span_start, text_end)
                if keep_start < keep_end:
                    copied = _copy_fragment_slice(
                        frag,
                        keep_start - text_start,
                        keep_end - text_start,
                        break_kept if first_slice else False,
                    )
                    if copied is not None:
                        result.append(copied)
                    first_slice = False
                cursor = max(cursor, min(span_end, text_end))
            if cursor < text_end:
                copied = _copy_fragment_slice(
                    frag,
                    cursor - text_start,
                    text_end - text_start,
                    break_kept if first_slice else False,
                )
                if copied is not None:
                    result.append(copied)
        pos = text_end

    return _strip_leading_breaks(result)


def _service_line_spans(text: str) -> List[Tuple[int, int]]:
    spans: List[Tuple[int, int]] = []
    for match in re.finditer(r"[^\n]*(?:Уровень\s+существенности|Аудитор\s*:)[^\n]*(?:\n|$)", text, re.IGNORECASE):
        spans.append(match.span())
    return spans


def _is_service_line(text: str) -> bool:
    return re.search(
        r"(?:Уровень\s+существенности|^\s*Аудитор\s*:)",
        text,
        re.IGNORECASE,
    ) is not None


def _split_runs_by_explicit_breaks(runs: List[RunFragment]) -> List[List[RunFragment]]:
    lines: List[List[RunFragment]] = []
    current: List[RunFragment] = []
    for frag in clone_runs(runs):
        if frag.br_before and current:
            lines.append(current)
            current = [frag]
        else:
            current.append(frag)
    if current:
        lines.append(current)
    return lines


def _remove_service_lines_preserving_runs(runs: List[RunFragment]) -> List[RunFragment]:
    return _remove_text_spans_from_runs(runs, _service_line_spans(_runs_to_text(runs)))


def _clean_structured_recommendation_lines(text: str) -> List[str]:
    lines: List[str] = []
    for raw_line in text.splitlines():
        line = raw_line.replace("\t", " ").strip()
        if not line:
            continue
        if _is_service_line(line):
            continue
        line = AUDIT_REC_LABEL_RE.sub("\n", line, count=1)
        for part in line.splitlines():
            part = part.strip()
            if part:
                lines.append(part)
    return lines


def _fragment_rpr(frag: RunFragment) -> Optional[ET.Element]:
    if frag.rPr is not None:
        return copy.deepcopy(frag.rPr)
    if frag.raw_r is not None:
        r_pr = frag.raw_r.find(f"./{{{W_NS}}}rPr")
        if r_pr is not None:
            return copy.deepcopy(r_pr)
    return None


def _copy_plain_fragment_slice(frag: RunFragment, text: str, br_before: bool) -> RunFragment:
    return RunFragment(
        text=text,
        rPr=_fragment_rpr(frag),
        br_before=br_before,
        raw_r=None,
    )


def _trim_plain_line_runs(line_runs: List[RunFragment]) -> List[RunFragment]:
    text = "".join(frag.text or "" for frag in line_runs)
    start = len(text) - len(text.lstrip())
    end = len(text.rstrip())
    if end <= start:
        return []
    return _slice_runs_by_offsets(line_runs, start, end)


def _line_runs_without_break_markers(line_runs: List[RunFragment]) -> List[RunFragment]:
    clean_line: List[RunFragment] = []
    for frag in line_runs:
        clean_line.append(
            RunFragment(
                text=frag.text,
                rPr=copy.deepcopy(frag.rPr) if frag.rPr is not None else None,
                br_before=False,
                is_tab=frag.is_tab,
                raw_r=copy.deepcopy(frag.raw_r) if frag.raw_r is not None else None,
            )
        )
    return clean_line


def _remove_audit_recommendation_label_from_line(line_runs: List[RunFragment]) -> List[RunFragment]:
    clean_line = _line_runs_without_break_markers(line_runs)
    line_text = _runs_to_text_no_breaks(clean_line).replace("\t", " ")
    match = AUDIT_REC_LABEL_RE.search(line_text)
    if not match:
        return clean_line
    before = _trim_plain_line_runs(_slice_runs_by_offsets(clean_line, 0, match.start()))
    after = _trim_plain_line_runs(_slice_runs_by_offsets(clean_line, match.end(), len(line_text)))
    blank_separator = RunFragment(text="", br_before=True)
    if after:
        after[0].br_before = True
    return before + [blank_separator] + after


def _structured_recommendation_runs_from_source(runs: List[RunFragment]) -> List[RunFragment]:
    result: List[RunFragment] = []
    for line in _split_runs_by_explicit_breaks(_strip_images_from_runs(runs)):
        line_text = _runs_to_text_no_breaks(line).replace("\t", " ").strip()
        if not line_text or _is_service_line(line_text):
            continue
        line = _remove_audit_recommendation_label_from_line(line)
        line_text = _runs_to_text_no_breaks(line).replace("\t", " ").strip()
        has_blank_separator = any(not (frag.text or "") and frag.br_before for frag in line)
        if not line_text and not has_blank_separator:
            continue

        rebuilt_line: List[RunFragment] = []
        for frag in line:
            text = " " if frag.is_tab and not (frag.text or "") else (frag.text or "")
            text = text.replace("\t", " ")
            if not text and frag.br_before:
                rebuilt_line.append(RunFragment(text="", br_before=True))
                continue
            if not text:
                continue
            rebuilt_line.append(_copy_plain_fragment_slice(frag, text, br_before=frag.br_before))

        if not has_blank_separator:
            rebuilt_line = _trim_plain_line_runs(rebuilt_line)
        if not rebuilt_line:
            continue
        rebuilt_line[0].br_before = bool(result)
        result.extend(rebuilt_line)
    return result


def _has_structured_recommendation_fields(text: str) -> bool:
    if STRUCTURED_REC_LABEL_RE.search(text) or AUDIT_REC_LABEL_RE.search(text):
        return True
    return (
        OBJECT_AUDIT_RE.search(text) is not None
        and OBJECT_HEAD_RE.search(text) is not None
        and SROK_MARK_RE.search(text) is not None
    )


def _local_name(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def _strip_drawings_from_raw_run(raw_r: ET.Element) -> Optional[ET.Element]:
    cleaned = copy.deepcopy(raw_r)
    for parent in cleaned.iter():
        for child in list(parent):
            if _local_name(child.tag) in ("drawing", "pict", "object"):
                parent.remove(child)
    if not _run_has_payload(cleaned):
        return None
    return cleaned


def _strip_images_from_runs(runs: List[RunFragment]) -> List[RunFragment]:
    cleaned_runs: List[RunFragment] = []
    for frag in runs:
        raw_r = frag.raw_r
        if raw_r is not None:
            raw_r = _strip_drawings_from_raw_run(raw_r)
        if raw_r is None and not (frag.text or "") and not frag.is_tab:
            continue
        cleaned_runs.append(
            RunFragment(
                text=frag.text,
                rPr=copy.deepcopy(frag.rPr) if frag.rPr is not None else None,
                br_before=frag.br_before,
                is_tab=frag.is_tab,
                raw_r=raw_r,
            )
        )
    return cleaned_runs


def _normalize_recommendation_runs(runs: List[RunFragment]) -> List[RunFragment]:
    normalized: List[RunFragment] = []
    at_line_start = True
    for frag in runs:
        if frag.br_before:
            at_line_start = True
        if frag.is_tab:
            if not at_line_start:
                normalized.append(
                    RunFragment(
                        text="",
                        rPr=copy.deepcopy(frag.rPr) if frag.rPr is not None else None,
                        br_before=frag.br_before,
                        is_tab=True,
                    )
                )
                at_line_start = False
            continue
        text = frag.text or ""
        if not text:
            if frag.br_before:
                normalized.append(RunFragment(text="", br_before=True))
                at_line_start = True
            continue
        text = re.sub(r"\n[ \t]+", "\n", text)
        parts = text.split("\n")
        for idx, part in enumerate(parts):
            br_before = frag.br_before if idx == 0 else True
            if br_before:
                at_line_start = True
            if part:
                lead_len = len(part) - len(part.lstrip(" \t"))
                if lead_len:
                    lead_ws = part[:lead_len]
                    rest = part[lead_len:]
                    if at_line_start:
                        part = rest
                    else:
                        if normalized and (normalized[-1].text or normalized[-1].is_tab):
                            normalized[-1].text = (normalized[-1].text or "") + lead_ws
                        part = rest
            if part == "":
                if br_before:
                    normalized.append(RunFragment(text="", br_before=True))
                at_line_start = True
                continue
            normalized.append(
                RunFragment(
                    text=part,
                    rPr=copy.deepcopy(frag.rPr) if frag.rPr is not None else None,
                    br_before=br_before,
                )
            )
            at_line_start = False
    return normalized


def _trim_rec_runs_to_last_srok(runs: List[RunFragment]) -> List[RunFragment]:
    text = _runs_to_text_no_breaks(runs)
    matches = list(SROK_MARK_RE.finditer(text))
    if not matches:
        return runs
    start = matches[0].start()
    end = len(text)
    idx = start

    def _find_sentence_end(start_idx: int) -> int:
        i = start_idx
        while i < len(text):
            ch = text[i]
            if ch == "\n":
                return i + 1
            if ch == ".":
                prev_is_digit = i > 0 and text[i - 1].isdigit()
                next_is_digit = i + 1 < len(text) and text[i + 1].isdigit()
                if prev_is_digit and next_is_digit:
                    i += 1
                    continue
                return i + 1
            i += 1
        return len(text)

    while idx < len(text):
        end = _find_sentence_end(idx)
        next_idx = end
        while next_idx < len(text) and text[next_idx].isspace():
            next_idx += 1
        if next_idx >= len(text):
            break
        if not SROK_MARK_RE.match(text, next_idx):
            break
        idx = next_idx
    return _truncate_runs_to_offset(runs, end)


def _extract_rec_runs_from_block(block: List[Tuple[str, List[RunFragment]]]) -> Optional[List[RunFragment]]:
    rec_runs: List[RunFragment] = []
    started = False
    for p_text, runs in block:
        if not p_text:
            continue
        if not started:
            m = REC_LABEL_RE.search(p_text)
            if not m:
                continue
            started = True
            rec_runs.extend(_split_runs_by_offset(runs, m.end()))
        else:
            if rec_runs and runs:
                runs[0].br_before = True
            rec_runs.extend(runs)
    if not rec_runs:
        return None
    rec_runs = _strip_leading_breaks(rec_runs)
    rec_runs = _trim_rec_runs_to_last_srok(rec_runs)
    rec_runs = _strip_images_from_runs(rec_runs)
    return rec_runs or None


def _extract_rec_entries_from_runs(runs: List[RunFragment]) -> List[RecommendationEntry]:
    if not runs:
        return []
    text = _runs_to_text(runs)
    if not _has_structured_recommendation_fields(text):
        return []
    lines = _clean_structured_recommendation_lines(_runs_to_text(_strip_images_from_runs(runs)))
    rec_runs = _structured_recommendation_runs_from_source(runs)
    rec_text = "\n".join(lines).strip()
    if not rec_text:
        return []
    return [RecommendationEntry(text=rec_text, runs=rec_runs or None)]


def _combine_block_runs(blocks: List[DocumentBlock]) -> List[RunFragment]:
    combined: List[RunFragment] = []
    for block in blocks:
        runs = clone_runs(block.runs)
        if combined and runs:
            runs[0].br_before = True
        combined.extend(runs)
    return combined


def _extract_rec_entries_from_table_blocks(blocks: List[DocumentBlock]) -> List[RecommendationEntry]:
    entries: List[RecommendationEntry] = []
    table_indexes = []
    for block in blocks:
        if block.kind != "table_cell" or block.table_index is None:
            continue
        if block.table_index not in table_indexes:
            table_indexes.append(block.table_index)

    for table_index in table_indexes:
        table_blocks = [block for block in blocks if block.table_index == table_index]
        table_text = "\n".join(block.text for block in table_blocks if block.text.strip())
        if not _has_structured_recommendation_fields(table_text):
            continue
        entries.extend(_extract_rec_entries_from_runs(_combine_block_runs(table_blocks)))
    return entries


def _extract_rec_entries_from_framed_paragraphs(blocks: List[DocumentBlock]) -> List[RecommendationEntry]:
    entries: List[RecommendationEntry] = []
    current_group: List[DocumentBlock] = []

    def flush_group() -> None:
        nonlocal current_group
        if not current_group:
            return
        entries.extend(_extract_rec_entries_from_runs(_combine_block_runs(current_group)))
        current_group = []

    for block in blocks:
        if block.kind == "paragraph" and block.has_frame_border:
            current_group.append(block)
            continue
        flush_group()
    flush_group()
    return entries


def parse_observations_from_file(file_path: str) -> List[Observation]:
    """Парсит наблюдения из .docx файла (ZIP + XML, без python-docx)."""
    root = load_document_xml(file_path)
    blocks, _textboxes = extract_document_blocks(root)
    section3_start = _find_section3_flat_block_idx(blocks)
    text = "\n".join(block.text for block in blocks[section3_start:] if block.text.strip())
    return parse_observations(text)


def _iter_observation_starts(blocks, section3_start: int) -> List[Tuple[int, str]]:
    """Первые вхождения наблюдений строго в порядке блоков документа."""
    starts: List[Tuple[int, str]] = []
    seen: set[str] = set()
    summary_indices = find_sokol_summary_block_indices(blocks)
    for idx, block in enumerate(blocks):
        if idx < section3_start:
            continue
        if idx in summary_indices:
            continue
        if getattr(block, "has_frame_border", False):
            continue
        if block.cell_index not in (None, 0):
            continue
        match = OBS_BLOCK_START_RE.match(block.text or "")
        if not match:
            continue
        obs_num = match.group(1)
        if obs_num in seen:
            continue
        seen.add(obs_num)
        starts.append((idx, obs_num))
    return starts


def parse_observations_from_file_with_runs(file_path: str) -> List[Observation]:
    """Парсит наблюдения и сохраняет форматирование runs для имени и рекомендаций."""
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return []

    section3_top_level_idx = xml_utils.find_insert_before_section3(body, min_idx=0)
    table_min_idx = section3_top_level_idx if section3_top_level_idx is not None else 0

    table_name_runs, _table_order = extract_name_runs_from_tables(root, min_block_idx=table_min_idx)
    blocks, textboxes = extract_document_blocks(root)
    section3_start = _find_section3_flat_block_idx(blocks)

    # Порядок = только порядок появления в документе. Никакой дописки «в конец».
    ordered_starts = _iter_observation_starts(blocks, section3_start)
    if not ordered_starts:
        return []

    text = "\n".join(block.text for block in blocks[section3_start:] if block.text.strip())
    parsed_by_number = {obs.number: obs for obs in parse_observations(text)}

    observations: List[Observation] = []
    for _idx, obs_num in ordered_starts:
        if obs_num in parsed_by_number:
            observations.append(parsed_by_number[obs_num])
            continue
        name_runs = clone_runs(table_name_runs[obs_num]) if obs_num in table_name_runs else None
        observations.append(
            Observation(
                number=obs_num,
                chapter=obs_num.split(".")[0] if obs_num else "",
                chapter_title="",
                name=runs_to_text(name_runs) if name_runs else "",
                materiality_level="",
                recommendations="",
                deadline="",
                rec_label="Рекомендация",
                name_runs=name_runs,
                rec_runs=None,
            )
        )
    for obs in observations:
        if obs.number in table_name_runs:
            name_runs = clone_runs(table_name_runs[obs.number])
            obs.name_runs = name_runs
            obs.name = runs_to_text(name_runs)

    block_heading_state, heading_map = build_block_heading_state(blocks)
    obs_start_idx: dict = {obs_num: idx for idx, obs_num in ordered_starts}

    for obs_idx, obs in enumerate(observations):
        start_idx = obs_start_idx.get(obs.number)
        if start_idx is None:
            continue
        state_chapter, state_title = block_heading_state.get(start_idx, ("", ""))
        if state_chapter:
            obs.chapter = state_chapter
        if state_title:
            obs.chapter_title = state_title
        elif obs.chapter:
            if obs.chapter in heading_map:
                obs.chapter_title = heading_map[obs.chapter]
            else:
                base = obs.chapter.split(".")[0]
                if base in heading_map:
                    obs.chapter_title = heading_map[base]

        end_idx = len(blocks)
        for next_idx in range(obs_idx + 1, len(observations)):
            next_start = obs_start_idx.get(observations[next_idx].number)
            if next_start is not None:
                end_idx = next_start
                break

        observation_blocks = blocks[start_idx:end_idx]
        fallback_block = [
            (item.text, item.runs)
            for item in observation_blocks
            if item.kind == "paragraph" and not item.has_frame_border
        ]
        rec_entries: List[RecommendationEntry] = []
        for textbox in textboxes:
            if start_idx <= textbox.anchor_index < end_idx:
                rec_entries.extend(_extract_rec_entries_from_runs(textbox.runs))
        rec_entries.extend(_extract_rec_entries_from_framed_paragraphs(observation_blocks))
        rec_entries.extend(_extract_rec_entries_from_table_blocks(observation_blocks))
        if rec_entries:
            obs.rec_entries = rec_entries
            obs.rec_runs = None
        else:
            obs.rec_runs = _extract_rec_runs_from_block(fallback_block)
        block_text = " ".join(item.text for item in observation_blocks)
        obs.materiality_level = extract_materiality_from_text(block_text)
        obs.deadline = extract_deadline_from_text(block_text)
        obs.rec_label = extract_rec_label(block_text)

    return observations
