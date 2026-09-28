"""Slice, clean and extract recommendation runs from observation blocks."""

from __future__ import annotations

import copy
import re
from typing import List, Optional, Tuple

import xml.etree.ElementTree as ET

from sokol_reports.ooxml import XML_NS, W_NS
from sokol_reports.section_ii.docx_blocks import (
    DocumentBlock,
    clone_runs,
    local_name,
    run_has_payload,
    runs_to_text,
)
from sokol_reports.section_ii.models import RecommendationEntry, RunFragment
from sokol_reports.section_ii.patterns import AUDIT_REC_LABEL_RE, REC_LABEL_RE, SROK_MARK_RE

STRUCTURED_REC_LABEL_RE = re.compile(
    r"(?:^|\n)\s*(?:Аудиторск\w*\s+рекомендац\w*|Рекомендаци[яи]|Мероприятия\s+после\s+аудита)\s*[:—–\-]",
    re.IGNORECASE,
)
OBJECT_AUDIT_RE = re.compile(r"(?:^|\n)\s*Объект\s+аудита\s*[:—–\-]", re.IGNORECASE)
OBJECT_HEAD_RE = re.compile(
    r"(?:^|\n)\s*Руководител[ья]\s+объекта\s+аудита\s*[:—–\-]",
    re.IGNORECASE,
)


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


def strip_leading_breaks(runs: List[RunFragment]) -> List[RunFragment]:
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


def runs_to_text_no_breaks(runs: List[RunFragment]) -> str:
    parts: List[str] = []
    for frag in runs:
        parts.append(frag.text or "")
    return "".join(parts)


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

    return strip_leading_breaks(result)


def slice_runs_by_offsets(
    runs: List[RunFragment],
    start_offset: int,
    end_offset: Optional[int] = None,
) -> List[RunFragment]:
    text_len = len(runs_to_text(runs))
    start_offset = max(0, start_offset)
    end_offset = text_len if end_offset is None else min(text_len, max(start_offset, end_offset))
    remove_spans = [(0, start_offset), (end_offset, text_len)]
    return _remove_text_spans_from_runs(runs, remove_spans)


def split_runs_by_offset(runs: List[RunFragment], offset: int) -> List[RunFragment]:
    return slice_runs_by_offsets(runs, offset)


def truncate_runs_to_offset(runs: List[RunFragment], offset: int) -> List[RunFragment]:
    return slice_runs_by_offsets(runs, 0, offset)


def is_service_line(text: str) -> bool:
    return re.search(
        r"(?:Уровень\s+существенности|^\s*Аудитор\s*:)",
        text,
        re.IGNORECASE,
    ) is not None


def split_runs_by_explicit_breaks(runs: List[RunFragment]) -> List[List[RunFragment]]:
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


def clean_structured_recommendation_lines(text: str) -> List[str]:
    lines: List[str] = []
    for raw_line in text.splitlines():
        line = raw_line.replace("\t", " ").strip()
        if not line:
            continue
        if is_service_line(line):
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


def trim_plain_line_runs(line_runs: List[RunFragment]) -> List[RunFragment]:
    text = "".join(frag.text or "" for frag in line_runs)
    start = len(text) - len(text.lstrip())
    end = len(text.rstrip())
    if end <= start:
        return []
    return slice_runs_by_offsets(line_runs, start, end)


def line_runs_without_break_markers(line_runs: List[RunFragment]) -> List[RunFragment]:
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


def remove_audit_recommendation_label_from_line(line_runs: List[RunFragment]) -> List[RunFragment]:
    clean_line = line_runs_without_break_markers(line_runs)
    line_text = runs_to_text_no_breaks(clean_line).replace("\t", " ")
    match = AUDIT_REC_LABEL_RE.search(line_text)
    if not match:
        return clean_line
    before = trim_plain_line_runs(slice_runs_by_offsets(clean_line, 0, match.start()))
    after = trim_plain_line_runs(slice_runs_by_offsets(clean_line, match.end(), len(line_text)))
    blank_separator = RunFragment(text="", br_before=True)
    if after:
        after[0].br_before = True
    return before + [blank_separator] + after


def _strip_drawings_from_raw_run(raw_r: ET.Element) -> Optional[ET.Element]:
    cleaned = copy.deepcopy(raw_r)
    for parent in cleaned.iter():
        for child in list(parent):
            if local_name(child.tag) in ("drawing", "pict", "object"):
                parent.remove(child)
    if not run_has_payload(cleaned):
        return None
    return cleaned


def strip_images_from_runs(runs: List[RunFragment]) -> List[RunFragment]:
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


def structured_recommendation_runs_from_source(runs: List[RunFragment]) -> List[RunFragment]:
    result: List[RunFragment] = []
    for line in split_runs_by_explicit_breaks(strip_images_from_runs(runs)):
        line_text = runs_to_text_no_breaks(line).replace("\t", " ").strip()
        if not line_text or is_service_line(line_text):
            continue
        line = remove_audit_recommendation_label_from_line(line)
        line_text = runs_to_text_no_breaks(line).replace("\t", " ").strip()
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
            rebuilt_line = trim_plain_line_runs(rebuilt_line)
        if not rebuilt_line:
            continue
        rebuilt_line[0].br_before = bool(result)
        result.extend(rebuilt_line)
    return result


def has_structured_recommendation_fields(text: str) -> bool:
    if STRUCTURED_REC_LABEL_RE.search(text) or AUDIT_REC_LABEL_RE.search(text):
        return True
    return (
        OBJECT_AUDIT_RE.search(text) is not None
        and OBJECT_HEAD_RE.search(text) is not None
        and SROK_MARK_RE.search(text) is not None
    )


def trim_rec_runs_to_last_srok(runs: List[RunFragment]) -> List[RunFragment]:
    text = runs_to_text_no_breaks(runs)
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
    return truncate_runs_to_offset(runs, end)


def extract_rec_runs_from_block(block: List[Tuple[str, List[RunFragment]]]) -> Optional[List[RunFragment]]:
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
            rec_runs.extend(split_runs_by_offset(runs, m.end()))
        else:
            if rec_runs and runs:
                runs[0].br_before = True
            rec_runs.extend(runs)
    if not rec_runs:
        return None
    rec_runs = strip_leading_breaks(rec_runs)
    rec_runs = trim_rec_runs_to_last_srok(rec_runs)
    rec_runs = strip_images_from_runs(rec_runs)
    return rec_runs or None


def extract_rec_entries_from_runs(runs: List[RunFragment]) -> List[RecommendationEntry]:
    if not runs:
        return []
    text = runs_to_text(runs)
    if not has_structured_recommendation_fields(text):
        return []
    lines = clean_structured_recommendation_lines(runs_to_text(strip_images_from_runs(runs)))
    rec_runs = structured_recommendation_runs_from_source(runs)
    rec_text = "\n".join(lines).strip()
    if not rec_text:
        return []
    return [RecommendationEntry(text=rec_text, runs=rec_runs or None)]


def combine_block_runs(blocks: List[DocumentBlock]) -> List[RunFragment]:
    combined: List[RunFragment] = []
    for block in blocks:
        runs = clone_runs(block.runs)
        if combined and runs:
            runs[0].br_before = True
        combined.extend(runs)
    return combined


def extract_rec_entries_from_table_blocks(blocks: List[DocumentBlock]) -> List[RecommendationEntry]:
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
        if not has_structured_recommendation_fields(table_text):
            continue
        entries.extend(extract_rec_entries_from_runs(combine_block_runs(table_blocks)))
    return entries


def extract_rec_entries_from_framed_paragraphs(blocks: List[DocumentBlock]) -> List[RecommendationEntry]:
    entries: List[RecommendationEntry] = []
    current_group: List[DocumentBlock] = []

    def flush_group() -> None:
        nonlocal current_group
        if not current_group:
            return
        entries.extend(extract_rec_entries_from_runs(combine_block_runs(current_group)))
        current_group = []

    for block in blocks:
        if block.kind == "paragraph" and block.has_frame_border:
            current_group.append(block)
            continue
        flush_group()
    flush_group()
    return entries
