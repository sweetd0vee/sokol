import re
from typing import List, Optional, Tuple

from app.services.reports.section_ii.models import Observation
from app.services.reports.section_ii.patterns import (
    CHAPTER_RE,
    NAME_CUTOFF_PATTERNS,
    OBS_LINE_START_RE,
    REC_LABEL_RE,
    ROMAN_HEADING_RE,
    SROK_TAIL_RE,
    SUBCHAPTER_RE,
)


def roman_to_int(value: str) -> Optional[int]:
    roman_map = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    prev = 0
    for ch in value.upper():
        if ch not in roman_map:
            return None
        cur = roman_map[ch]
        if cur > prev:
            total += cur - 2 * prev
        else:
            total += cur
        prev = cur
    return total or None


def int_to_roman(value: int) -> str:
    pairs = [
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    ]
    remaining = value
    parts: List[str] = []
    for num, numeral in pairs:
        while remaining >= num:
            parts.append(numeral)
            remaining -= num
    return "".join(parts)


def format_chapter_heading(chapter: str, title: str) -> str:
    chapter = (chapter or "").strip()
    title = (title or "").strip()
    if not title and not chapter:
        return ""
    if not title:
        return f"Раздел {chapter}" if chapter else ""
    if ROMAN_HEADING_RE.match(title):
        return title
    if chapter.isdigit():
        return f"{int_to_roman(int(chapter))}. {title}"
    if chapter:
        return f"{chapter}. {title}"
    return title


def normalize_heading_num(raw_num: str) -> str:
    if raw_num.isdigit():
        return raw_num
    roman_num = roman_to_int(raw_num)
    return str(roman_num) if roman_num else raw_num


def parse_heading_line(p_text: str) -> Tuple[Optional[str], str, str]:
    ch_match = CHAPTER_RE.search(p_text)
    if ch_match:
        raw_num = ch_match.group(2)
        title_part = (ch_match.group(3) or "").strip().split("\n")[0]
        return ("chapter", normalize_heading_num(raw_num), title_part)
    roman_match = ROMAN_HEADING_RE.search(p_text)
    if roman_match:
        raw_num = roman_match.group(1)
        title_part = roman_match.group(2).strip().split("\n")[0]
        return ("roman", normalize_heading_num(raw_num), title_part)
    sub_match = SUBCHAPTER_RE.search(p_text)
    if sub_match:
        num = sub_match.group(1)
        title_part = sub_match.group(2).strip().split("\n")[0]
        return ("subchapter", num, title_part)
    return (None, "", "")


def extract_materiality_from_text(text: str) -> str:
    mat_match = re.search(
        r"Уровень\s+существенности\s*[:—–\-]\s*(низкий|средний|высокий)",
        text,
        re.IGNORECASE,
    )
    materiality = (mat_match.group(1) if mat_match else "").strip().lower()
    return materiality or "не указан"


def extract_deadline_from_text(text: str) -> str:
    deadline_match = SROK_TAIL_RE.search(text)
    if not deadline_match:
        return ""
    matched = re.sub(r"\s+", " ", deadline_match.group(0)).strip(" .")
    matched = re.sub(
        r"^Срок(?:\s+(?:исполнения|реализации|выполнения))?\s*(?:[—–\-:]?\s*)?(?:до\s*)?",
        "",
        matched,
        flags=re.IGNORECASE,
    ).strip()
    return matched


def extract_rec_label(text: str) -> str:
    rec_label = "Рекомендация"
    rec_match = REC_LABEL_RE.search(text)
    if rec_match:
        label_found = rec_match.group(1)
        if "Мероприятия" in label_found or "мероприятия" in label_found.lower():
            rec_label = "Мероприятия после аудита"
    return rec_label


def extract_recommendation_from_text(block: str) -> tuple[str, str]:
    rec_label = "Рекомендация"
    rec_match = re.search(
        r"(Аудиторские\s+рекомендации|Рекомендация|Мероприятия\s+после\s+аудита)\s*[:\-]?\s*(.+)",
        block,
        re.IGNORECASE | re.DOTALL,
    )
    if not rec_match:
        return rec_label, ""

    label_found = rec_match.group(1)
    if "Мероприятия" in label_found or "мероприятия" in label_found.lower():
        rec_label = "Мероприятия после аудита"
    full_rec = rec_match.group(2).strip()
    srok_match = SROK_TAIL_RE.search(full_rec)
    recommendations = full_rec[: srok_match.end()].strip() if srok_match else full_rec
    return rec_label, recommendations


def extract_name_from_text(block: str) -> str:
    """Название наблюдения — первая строка заголовка, без тела («Проверкой установлено…»)."""
    name = block
    for pattern in NAME_CUTOFF_PATTERNS:
        m = re.search(pattern, block, re.IGNORECASE)
        if m:
            name = block[: m.start()].strip()
            break
    # В АЗ заголовок — отдельный абзац; следующие строки — описание нарушения.
    first_line = next((line.strip() for line in name.splitlines() if line.strip()), "")
    if first_line:
        name = first_line
    if len(name) > 120:
        name = name[:117].rsplit(" ", 1)[0] + "..." if " " in name[:120] else name[:120]
    return name


def parse_text_observations(text: str) -> List[Observation]:
    observations: List[Observation] = []
    # Только начала строк — иначе перекрёстные «см. Наблюдение 4.1» ломают порядок.
    obs_starts = list(OBS_LINE_START_RE.finditer(text))
    headings: List[Tuple[int, str, str]] = []
    for line_match in re.finditer(r"[^\n]+", text):
        heading_type, heading_num, heading_title = parse_heading_line(line_match.group(0))
        if heading_type in ("chapter", "roman") and heading_num:
            headings.append((line_match.start(), heading_num, heading_title))

    for i, match in enumerate(obs_starts):
        obs_num = match.group(1)
        start_pos = match.end()
        end_pos = obs_starts[i + 1].start() if i + 1 < len(obs_starts) else len(text)
        block = text[start_pos:end_pos]
        chapter = obs_num.split(".")[0] if obs_num else ""
        chapter_title = ""

        previous_headings = [heading for heading in headings if heading[0] < match.start()]
        if previous_headings:
            _heading_pos, heading_num, heading_title = previous_headings[-1]
            chapter = heading_num
            chapter_title = heading_title.strip()[:120]

        if not chapter_title:
            text_before = text[: match.start()]
            chapter_matches = list(
                re.finditer(
                    r"Глава\s+(\d+)[.\s]+(.+?)(?=\n|Глава\s+\d|Наблюдение|$)",
                    text_before,
                    re.IGNORECASE | re.DOTALL,
                )
            )
            if chapter_matches:
                last = chapter_matches[-1]
                chapter = last.group(1)
                chapter_title = " ".join(last.group(2).split()).strip()[:120]
            else:
                div_matches = list(
                    re.finditer(
                        r"Раздел\s+(\d+)[.\s]+(.+?)(?=\n|Раздел\s+\d|Наблюдение|$)",
                        text_before,
                        re.IGNORECASE | re.DOTALL,
                    )
                )
                if div_matches:
                    last = div_matches[-1]
                    chapter = last.group(1)
                    chapter_title = " ".join(last.group(2).split()).strip()[:120]

        rec_label, recommendations = extract_recommendation_from_text(block)
        observations.append(
            Observation(
                number=obs_num,
                chapter=chapter,
                chapter_title=chapter_title,
                name=extract_name_from_text(block),
                materiality_level=extract_materiality_from_text(block),
                recommendations=recommendations,
                deadline=extract_deadline_from_text(block),
                rec_label=rec_label,
            )
        )

    return observations
