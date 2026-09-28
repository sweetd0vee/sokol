import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from sokol_reports.section_ii.field_parser import normalize_heading_num, parse_heading_line
from sokol_reports.section_ii.models import RunFragment
from sokol_reports.section_ii.patterns import (
    OBS_BLOCK_START_RE,
    OBS_START_RE,
    SECTION2_START_RE,
    W_NS,
)
from sokol_reports.section_ii.xml_utils import is_sokol_summary_table_text

SECTION_TITLE_REF_RE = re.compile(r"Аудиторское\s*мнение", re.IGNORECASE)
ROMAN_ONLY_RE = re.compile(r"^\s*([IVXLCDM]+)\s*[.)–—\-:]?\s*$", re.IGNORECASE)
ROMAN_WITH_TITLE_RE = re.compile(
    r"^\s*([IVXLCDM]+)(?:\s*[.)–—\-:]+\s*|\s+)(.+)$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class HeadingFormatSignature:
    bold: bool = True
    size: Optional[str] = None
    font: Optional[str] = None


def _run_is_bold(rPr) -> bool:
    if rPr is None:
        return False
    bold_el = rPr.find(f"./{{{W_NS}}}b")
    if bold_el is None:
        return False
    val = bold_el.get(f"{{{W_NS}}}val")
    return val is None or val not in ("0", "false", "off")


def _run_font_size(rPr) -> Optional[str]:
    if rPr is None:
        return None
    sz = rPr.find(f"./{{{W_NS}}}sz")
    return sz.get(f"{{{W_NS}}}val") if sz is not None else None


def _run_font_name(rPr) -> Optional[str]:
    if rPr is None:
        return None
    r_fonts = rPr.find(f"./{{{W_NS}}}rFonts")
    if r_fonts is None:
        return None
    return r_fonts.get(f"{{{W_NS}}}ascii") or r_fonts.get(f"{{{W_NS}}}hAnsi")


def _fragment_visible_text(frag: RunFragment) -> str:
    """Текст прогона без табов. Прогон из одного w:tab не должен ломать формат заголовка."""
    return (frag.text or "").replace("\t", "").strip()


def extract_dominant_run_format(runs: List[RunFragment]) -> HeadingFormatSignature:
    bold_votes = 0
    regular_votes = 0
    sizes: dict[str, int] = {}
    fonts: dict[str, int] = {}
    for frag in runs:
        text = _fragment_visible_text(frag)
        if not text:
            continue
        if _run_is_bold(frag.rPr):
            bold_votes += len(text) or 1
        else:
            regular_votes += len(text) or 1
        size = _run_font_size(frag.rPr)
        if size:
            sizes[size] = sizes.get(size, 0) + (len(text) or 1)
        font = _run_font_name(frag.rPr)
        if font:
            fonts[font] = fonts.get(font, 0) + (len(text) or 1)
    dominant_size = max(sizes, key=sizes.get) if sizes else None
    dominant_font = max(fonts, key=fonts.get) if fonts else None
    return HeadingFormatSignature(
        bold=bold_votes >= regular_votes and bold_votes > 0,
        size=dominant_size,
        font=dominant_font,
    )


def paragraph_matches_heading_format(
    runs: List[RunFragment],
    signature: HeadingFormatSignature,
) -> bool:
    if not runs:
        return False
    substantive = [frag for frag in runs if _fragment_visible_text(frag)]
    if not substantive:
        return False
    if signature.bold:
        if not all(_run_is_bold(frag.rPr) for frag in substantive):
            return False
    paragraph_format = extract_dominant_run_format(runs)
    if signature.size and paragraph_format.size and paragraph_format.size != signature.size:
        return False
    if signature.font and paragraph_format.font and paragraph_format.font != signature.font:
        return False
    return True


def find_reference_heading_format(
    paragraphs: List[Tuple[str, List[RunFragment]]],
) -> HeadingFormatSignature:
    for text, runs in paragraphs:
        if not SECTION_TITLE_REF_RE.search(text or ""):
            continue
        fmt = extract_dominant_run_format(runs)
        if fmt.bold:
            return fmt
    for text, runs in paragraphs:
        if not ROMAN_WITH_TITLE_RE.match((text or "").strip()):
            continue
        if SECTION_TITLE_REF_RE.search(text or ""):
            continue
        fmt = extract_dominant_run_format(runs)
        if fmt.bold:
            return fmt
    return HeadingFormatSignature(bold=True, size="28", font="Times New Roman")


def parse_section_heading_text(text: str) -> Tuple[Optional[str], str, str]:
    normalized = " ".join((text or "").split())
    if not normalized or OBS_START_RE.search(normalized):
        return (None, "", "")
    heading_type, heading_num, heading_title = parse_heading_line(normalized)
    if heading_type in ("chapter", "roman") and heading_num:
        return (heading_type, heading_num, heading_title)
    roman_only = ROMAN_ONLY_RE.match(normalized)
    if roman_only:
        return ("roman", normalize_heading_num(roman_only.group(1)), "")
    return (None, "", "")


def is_section_heading_paragraph(
    text: str,
    runs: List[RunFragment],
    signature: HeadingFormatSignature,
) -> bool:
    heading_type, _num, _title = parse_section_heading_text(text)
    if not heading_type:
        return False
    return paragraph_matches_heading_format(runs, signature)


def _section2_start_block_idx(blocks, min_block_idx: int = 0) -> int:
    section2_indices: List[int] = []
    for idx, block in enumerate(blocks):
        if idx < min_block_idx:
            continue
        if block.cell_index is not None:
            continue
        text = (block.text or "").strip()
        if SECTION2_START_RE.search(text):
            section2_indices.append(idx)
    if len(section2_indices) >= 2:
        return section2_indices[1]
    if section2_indices:
        return section2_indices[0]
    return min_block_idx


def build_block_heading_state(
    blocks,
    min_block_idx: int = 0,
) -> Tuple[dict[int, tuple[str, str]], dict[str, str]]:
    paragraphs = [(block.text, block.runs) for block in blocks]
    signature = find_reference_heading_format(paragraphs)
    heading_map: dict[str, str] = {}
    block_heading_state: dict[int, tuple[str, str]] = {}
    heading_chapter = ""
    heading_title = ""
    pending_roman = ""
    body_gate = _body_content_start_idx(blocks, min_block_idx, signature)
    seen_body_heading = False

    for idx, block in enumerate(blocks):
        if idx < body_gate:
            block_heading_state[idx] = ("", "")
            continue

        if block.cell_index is not None:
            block_heading_state[idx] = (heading_chapter, heading_title)
            continue
        text = (block.text or "").strip()

        is_fmt_heading = is_section_heading_paragraph(block.text, block.runs, signature)
        heading_type, heading_num, parsed_title = parse_section_heading_text(block.text)
        # После входа в тело принимаем и «неидеальные» римские/главные заголовки (III без bold),
        # иначе наблюдения 3.x остаются привязаны к предыдущему разделу I/II.
        is_loose_section = (
            heading_type in ("roman", "chapter")
            and bool(heading_num)
            and not OBS_START_RE.search(text)
        )
        if is_fmt_heading or is_loose_section:
            seen_body_heading = True
            if parsed_title:
                heading_chapter = heading_num
                heading_title = parsed_title
                heading_map[heading_num] = parsed_title
                pending_roman = ""
            else:
                pending_roman = heading_num
        elif (
            pending_roman
            and text
            and not OBS_START_RE.search(text)
            and (
                paragraph_matches_heading_format(block.runs, signature)
                or seen_body_heading
            )
        ):
            heading_chapter = pending_roman
            heading_title = " ".join(text.split("\n")[0].split())
            heading_map[pending_roman] = heading_title
            pending_roman = ""
            seen_body_heading = True

        block_heading_state[idx] = (heading_chapter, heading_title)

    return block_heading_state, heading_map


def _body_content_start_idx(blocks, min_block_idx: int, signature: HeadingFormatSignature) -> int:
    """
    Начало основного текста после оглавления: первый заголовок I/II
    в формате настоящих заголовков разделов (только абзацы тела, не ячейки таблиц).
    """
    for idx, block in enumerate(blocks):
        if idx < min_block_idx:
            continue
        # Заголовки разделов — только top-level абзацы. Ячейки вроде «I Q 2026» игнорируем.
        if block.cell_index is not None:
            continue
        if not is_section_heading_paragraph(block.text, block.runs, signature):
            continue
        roman_num = parse_section_heading_text(block.text)[1]
        if roman_num in {"1", "2"}:
            return idx
    section2_start = _section2_start_block_idx(blocks, min_block_idx=min_block_idx)
    return section2_start


def find_section3_flat_block_idx(blocks, min_block_idx: int = 0) -> int:
    """
    Индекс начала детальной части (тело документа), не оглавления.

    Берём минимум из:
    - первого настоящего (по формату) заголовка раздела ≥ III;
    - первого наблюдения с номером ≥ 3.x / 3.3.1.

    Нижняя граница — тело после TOC (раздел I/II), а не «второй II»,
    чтобы не пропустить наблюдения раздела 3 до заголовка IV.
    """
    paragraphs = [(block.text, block.runs) for block in blocks]
    signature = find_reference_heading_format(paragraphs)
    body_gate = _body_content_start_idx(blocks, min_block_idx, signature)
    candidates: List[int] = []
    for idx, block in enumerate(blocks):
        if idx < body_gate:
            continue
        if getattr(block, "has_frame_border", False):
            continue
        text = (block.text or "").strip()
        if not text:
            continue
        # Заголовки разделов — только из абзацев тела.
        if block.cell_index is None and is_section_heading_paragraph(block.text, block.runs, signature):
            roman_num = parse_section_heading_text(block.text)[1]
            if roman_num and roman_num.isdigit() and int(roman_num) >= 3:
                candidates.append(idx)
                continue
        # Наблюдения: абзац или первая колонка таблицы.
        if block.cell_index not in (None, 0):
            continue
        obs_match = OBS_BLOCK_START_RE.match(text)
        if obs_match:
            major = obs_match.group(1).split(".")[0]
            if major.isdigit() and int(major) >= 3:
                candidates.append(idx)
    return min(candidates) if candidates else body_gate


def find_sokol_summary_block_indices(blocks) -> set[int]:
    """Индексы flat-блоков внутри уже сгенерированной сводной таблицы раздела II."""
    summary_indices: set[int] = set()
    table_groups: dict[int, list[int]] = {}
    for idx, block in enumerate(blocks):
        if block.table_index is None:
            continue
        table_groups.setdefault(block.table_index, []).append(idx)
    for indices in table_groups.values():
        table_text = "\n".join((blocks[i].text or "") for i in indices)
        if is_sokol_summary_table_text(table_text):
            summary_indices.update(indices)
    return summary_indices
