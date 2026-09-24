import re
from typing import List, Optional, Tuple

from sokol_reports.section_ii.field_parser import roman_to_int
from sokol_reports.section_ii.patterns import OBS_BLOCK_START_RE, SECTION2_START_RE, W_NS

# Заголовок раздела III: только римское III или «Раздел 3», без голой арабской «3.» в тексте.
_SECTION3_HEADING = re.compile(
    r"^\s*(?:III|Раздел\s+3)\s*[.)–—\-:]?\s+(?!\d)\S|^\s*Раздел\s+3(?:[.\s]|$)",
    re.IGNORECASE,
)
# Заголовки основных разделов АЗ (I, II, III, IV… или «Раздел N»), не подпункты «3.1».
_MAJOR_SECTION_HEADING_RE = re.compile(
    r"^\s*(?:Раздел\s+(\d+)|([IVXLCDM]+))\s*[.)–—\-:]?\s+(?!\d)\S",
    re.IGNORECASE,
)

# Раздел I — Аудиторское мнение (должен идти до раздела II)
_SECTION1_START = re.compile(
    r"(?:^|\s)(?:Раздел\s+)?(?:I|1)\s*[.)–—\-:]?\s*Аудиторское\s*мнение\b|^\s*Аудиторское\s*мнение\b",
    re.IGNORECASE,
)
_SECTION1_NUMBER_ONLY = re.compile(
    r"^\s*(?:Раздел\s+)?(?:I|1)\s*[.)–—\-:]?\s*$",
    re.IGNORECASE,
)
_SECTION1_TITLE_ONLY = re.compile(r"^\s*Аудиторское\s*мнение\b", re.IGNORECASE)
# Римский/арабский заголовок без пробела после точки: «IV.Глава», «IV. Глава» (NBSP).
_MAJOR_SECTION_HEADING_LOOSE_RE = re.compile(
    r"^\s*(?:Раздел\s+)?([IVXLCDM]+|\d+)\s*[.)–—\-:]?\s*(?!\d)\S",
    re.IGNORECASE,
)


XML_WRAPPER_TAGS = frozenset({"sdt", "sdtContent", "customXml", "smartTag", "ins", "del"})


def local_tag(el) -> str:
    tag = getattr(el, "tag", "") or ""
    return tag.split("}")[-1] if "}" in tag else tag


def iter_unwrapped(parent, *target_tags: str):
    """Direct block children, descending into Word content-control wrappers."""
    targets = frozenset(target_tags)
    found: List[Tuple[str, object]] = []

    def walk(node) -> None:
        for child in node:
            tag = local_tag(child)
            if tag in targets:
                found.append((tag, child))
            elif tag in XML_WRAPPER_TAGS:
                walk(child)

    walk(parent)
    return found


def get_text_from_element(el) -> str:
    """Извлекает текст из XML-элемента. Таб после номера раздела — такой же разделитель, как пробел."""
    parts: List[str] = []
    for node in el.iter():
        tag = local_tag(node)
        if tag in ("tab", "ptab"):
            parts.append(" ")
        elif node.text:
            parts.append(node.text)
    return "".join(parts)


def get_blocks_from_xml(body) -> List[Tuple[str, object]]:
    """Возвращает список (тип, элемент) для параграфов и таблиц в body."""
    return iter_unwrapped(body, "p", "tbl")


def _paragraph_text(btype: str, el) -> str:
    if btype != "p":
        return ""
    return get_text_from_element(el).strip()


def parse_major_section_heading_number(text: str) -> Optional[int]:
    """Номер основного раздела, если абзац — заголовок раздела (не наблюдение и не «3.1»)."""
    normalized = (text or "").strip()
    match = _MAJOR_SECTION_HEADING_RE.match(normalized)
    if match:
        token = match.group(1) or match.group(2)
    else:
        loose = _MAJOR_SECTION_HEADING_LOOSE_RE.match(normalized)
        if not loose:
            return None
        token = loose.group(1)
    if token.isdigit():
        return int(token)
    return roman_to_int(token)


def _is_section3_heading_paragraph(text: str) -> bool:
    return bool(_SECTION3_HEADING.match((text or "").strip()))


def _paragraph_outline_level(el) -> Optional[int]:
    if el is None:
        return None
    p_pr = el.find(f"./{{{W_NS}}}pPr")
    if p_pr is None:
        return None
    outline = p_pr.find(f"./{{{W_NS}}}outlineLvl")
    if outline is None:
        return None
    try:
        return int(outline.get(f"{{{W_NS}}}val") or outline.get("val"))
    except (TypeError, ValueError):
        return None


def _paragraph_has_page_break(el) -> bool:
    for br in el.iter():
        if local_tag(br) != "br":
            continue
        br_type = br.get(f"{{{W_NS}}}type") or br.get("type")
        if br_type == "page":
            return True
    return False


def _is_top_level_section_boundary(btype: str, el, text: str) -> bool:
    """Граница основного раздела после раздела I (III, IV, …), не подпункт списка."""
    if btype != "p" or not text:
        return False
    if _is_section3_heading_paragraph(text):
        return True
    if SECTION2_START_RE.match(text):
        return True
    outline = _paragraph_outline_level(el)
    if outline == 0:
        return True
    section_num = parse_major_section_heading_number(text)
    return section_num is not None and section_num >= 3


def _find_body_match_for_toc_title(body, title: str, min_idx: int) -> Optional[int]:
    """Ищет в теле документа абзац, совпадающий с заголовком из содержания."""
    needle = " ".join((title or "").split())
    if len(needle) < 12:
        return None
    prefix = needle[:40]
    blocks = get_blocks_from_xml(body)
    for i in range(min_idx, len(blocks)):
        btype, el = blocks[i]
        if btype != "p":
            continue
        text = _paragraph_text(btype, el)
        if not text:
            continue
        normalized = " ".join(text.split())
        if normalized.startswith(prefix) or prefix in normalized:
            return i
    return None


def _find_insert_index_from_toc(body, section1_start: int, toc_max_idx: int) -> Optional[int]:
    """
    По содержанию: вставить раздел II перед первым разделом > II, найденным в теле.
    Нужно, когда в тексте нет раздела III, но есть IV+ (типичный шаблон АЗ).
    """
    blocks = get_blocks_from_xml(body)
    min_idx = max(section1_start + 1, toc_max_idx)
    toc_titles: List[Tuple[int, str]] = []
    for i in range(min(toc_max_idx, len(blocks))):
        btype, el = blocks[i]
        if btype != "p":
            continue
        text = _paragraph_text(btype, el)
        if not text or "HYPERLINK" in text:
            continue
        section_num = parse_major_section_heading_number(text)
        if section_num is not None and section_num > 2:
            toc_titles.append((section_num, text))

    if not toc_titles:
        return None

    toc_titles.sort(key=lambda item: item[0])
    for _num, title in toc_titles:
        body_idx = _find_body_match_for_toc_title(body, title, min_idx)
        if body_idx is not None:
            return body_idx
    return None


def _is_section2_heading_paragraph(text: str) -> bool:
    normalized = (text or "").strip()
    if not normalized:
        return False
    if SECTION2_START_RE.match(normalized):
        return True
    lowered = normalized.lower()
    return "основные результаты аудита" in lowered and "рекомендац" in lowered


def _find_first_top_level_boundary_after(
    body,
    start_scan: int,
) -> Optional[int]:
    blocks = get_blocks_from_xml(body)
    for i in range(start_scan, len(blocks)):
        btype, el = blocks[i]
        text = _paragraph_text(btype, el)
        if not text:
            if btype == "p" and _paragraph_has_page_break(el):
                for j in range(i + 1, min(i + 4, len(blocks))):
                    next_type, next_el = blocks[j]
                    next_text = _paragraph_text(next_type, next_el)
                    if _is_top_level_section_boundary(next_type, next_el, next_text):
                        return j
            continue
        if _is_top_level_section_boundary(btype, el, text):
            return i
        obs_match = OBS_BLOCK_START_RE.match(text)
        if obs_match:
            major = obs_match.group(1).split(".")[0]
            if major.isdigit() and int(major) >= 3:
                return i
    return None


def find_insert_index_for_new_section2(
    body,
    section1_start: int,
    min_idx: int = 0,
) -> int:
    """
    Индекс вставки нового раздела II: строго между разделом I и разделом III.
    После текста раздела I, перед заголовком III; если III в тексте нет — перед IV
    или первым наблюдением с номером ≥ 3.
    """
    start_scan = max(section1_start + 1, min_idx)

    section3_idx = find_insert_before_section3(body, min_idx=start_scan)
    if section3_idx is not None:
        return section3_idx

    toc_insert = _find_insert_index_from_toc(body, section1_start, min_idx)
    if toc_insert is not None:
        return toc_insert

    first_boundary = _find_first_top_level_boundary_after(body, start_scan)
    if first_boundary is not None:
        return first_boundary

    return start_scan


def is_sokol_summary_table_text(text: str) -> bool:
    """Таблица раздела II, сгенерированная SOKOL (не нативная таблица наблюдения в тексте)."""
    normalized = (text or "").replace("\n", " ")
    lowered = normalized.lower()
    if "основные нарушения" in lowered and "существен" in lowered:
        return True
    if "наименование" in lowered and "существен" in lowered:
        return True
    if "основные результаты" in lowered and "рекомендац" in lowered:
        return True
    return False


def find_generated_section2_block_ranges(body, min_idx: int = 0) -> List[Tuple[int, int]]:
    """
    Диапазоны блоков ранее сгенерированного раздела II для удаления перед повторной обработкой.
    Возвращает список (start_idx, end_idx) — end не включается.
    """
    blocks = get_blocks_from_xml(body)
    ranges: List[Tuple[int, int]] = []
    i = min_idx
    while i < len(blocks):
        btype, el = blocks[i]
        if btype == "p" and _is_section2_heading_paragraph(_paragraph_text(btype, el)):
            end = i + 1
            while end < len(blocks):
                next_type, next_el = blocks[end]
                if next_type == "p" and not _paragraph_text(next_type, next_el):
                    end += 1
                    continue
                break
            if end < len(blocks) and blocks[end][0] == "tbl":
                end += 1
                if end < len(blocks) and blocks[end][0] == "p" and _paragraph_has_page_break(blocks[end][1]):
                    end += 1
                ranges.append((i, end))
                i = end
                continue
        if btype == "tbl" and is_sokol_summary_table_text(get_text_from_element(el)):
            ranges.append((i, i + 1))
        i += 1
    return ranges


def find_section2_in_xml(body, min_idx: int = 0) -> Optional[Tuple[int, int]]:
    """
    Находит границы раздела II в XML body (именно в тексте, НЕ в содержании).
    Возвращает (start_idx, end_idx) или None.
    min_idx: искать только в блоках с индексом >= min_idx (пропускаем стр. 1–2 с содержанием).
    Первое «II. Основные результаты» — в содержании на стр. 2, второе — реальный раздел в тексте.
    """
    blocks = get_blocks_from_xml(body)
    start_idx = None
    for i, (btype, el) in enumerate(blocks):
        if i < min_idx:
            continue
        text = get_text_from_element(el).strip()
        if SECTION2_START_RE.match(text):
            start_idx = i
            break
    if start_idx is None:
        return None
    end_idx = len(blocks)
    for i in range(start_idx + 1, len(blocks)):
        btype, el = blocks[i]
        text = _paragraph_text(btype, el)
        if _is_top_level_section_boundary(btype, el, text):
            end_idx = i
            break
    return (start_idx, end_idx)


def find_insert_before_section3(body, min_idx: int = 0) -> Optional[int]:
    """
    Находит индекс блока перед разделом 3 (для вставки, если раздела II нет).
    min_idx: искать только в блоках >= min_idx (пропускаем содержание на стр. 2).
    """
    blocks = get_blocks_from_xml(body)
    for i, (btype, el) in enumerate(blocks):
        if i < min_idx:
            continue
        text = _paragraph_text(btype, el)
        if _is_section3_heading_paragraph(text):
            return i
    return None


def find_section1_start(body, min_idx: int = 0) -> Optional[int]:
    """
    Находит индекс раздела I в основном тексте (не в содержании).
    Берёт первый раздел I на/после min_idx; иначе — последний раздел I перед
    первым разделом II на/после min_idx.
    """
    blocks = get_blocks_from_xml(body)
    section1_indices: List[int] = []
    section2_indices: List[int] = []

    for i, (btype, el) in enumerate(blocks):
        text = get_text_from_element(el).strip() if btype == "p" else get_text_from_element(el)
        if _SECTION1_START.search(text):
            section1_indices.append(i)
            continue
        if _SECTION1_NUMBER_ONLY.search(text):
            if i + 1 < len(blocks):
                next_type, next_el = blocks[i + 1]
                next_text = (
                    get_text_from_element(next_el).strip()
                    if next_type == "p"
                    else get_text_from_element(next_el)
                )
                if _SECTION1_TITLE_ONLY.search(next_text):
                    section1_indices.append(i)
                    continue
        if _paragraph_text(btype, el) and SECTION2_START_RE.match(_paragraph_text(btype, el)):
            section2_indices.append(i)

    after_min = [idx for idx in section1_indices if idx >= min_idx]
    if after_min:
        return after_min[-1]

    body_section2 = next((idx for idx in section2_indices if idx >= min_idx), None)
    if body_section2 is not None:
        before_body_ii = [idx for idx in section1_indices if idx < body_section2]
        if before_body_ii:
            return before_body_ii[-1]

    return section1_indices[-1] if section1_indices else None


def find_first_block_after_page2(body) -> int:
    """
    Возвращает индекс первого блока на странице 3 (после страницы 2).
    Страница 2 = содержание (Разделы аудиторского заключения) — её не трогаем.
    Ищем второй разрыв страницы: после него начинается страница 3.
    """
    blocks = get_blocks_from_xml(body)
    page_break_count = 0
    for i, (_btype, el) in enumerate(blocks):
        for br in el.iter():
            if local_tag(br) != "br":
                continue
            br_type = br.get(f"{{{W_NS}}}type") or br.get("type")
            if br_type == "page":
                page_break_count += 1
                if page_break_count >= 2:
                    return min(i + 1, len(blocks))
    # Нет двух разрывов — эвристика: страницы 1+2 = первые 25 блоков (титул + содержание)
    return min(25, len(blocks))
