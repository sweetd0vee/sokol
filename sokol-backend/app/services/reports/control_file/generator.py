# -*- coding: utf-8 -*-
"""Парсинг АЗ под шаблон файла контроля (.xlsx)."""

import re
import shutil
from pathlib import Path
from typing import List, Optional, Tuple

from openpyxl import load_workbook
from openpyxl.styles import Alignment
from openpyxl.utils import get_column_letter

from app.services.reports.control_file.parser import parse_section_ii_for_control_file
from app.services.reports.control_file.title_parser import parse_az_title_from_docx
from app.services.reports.memorandum.parser import document_has_section_ii

TEMPLATE_PATH = Path(__file__).resolve().parents[4] / "data" / "файл контроля шаблон (шапка).xlsx"

COL_CHECK_NAME = 4
COL_CHECK_DATE = 2
COL_CHECK_LEADER = 5
COL_RECOMMENDATION = 6
COL_DEADLINE = 9
COL_RESPONSIBLE = 10
DATA_START_ROW = 2
_MANAGER_INITIALS_RE = re.compile(
    r"^[А-ЯЁA-Z][а-яёa-z]+\s+[А-ЯЁA-Z]\.\s*[А-ЯЁA-Z]\.?$"
)
_WRAPPED_TEXT_ALIGNMENT = Alignment(wrap_text=True, vertical="top")
_COLUMN_WIDTHS = {
    COL_CHECK_NAME: 45,
    COL_CHECK_LEADER: 22,
    COL_RECOMMENDATION: 80,
    COL_DEADLINE: 18,
    COL_RESPONSIBLE: 50,
}
_MIN_DATA_ROW_HEIGHT = 31.5
_LINE_HEIGHT = 15


def _normalize_manager(manager: str) -> str:
    mgr = (manager or "").strip().rstrip(".")
    if mgr and _MANAGER_INITIALS_RE.match(mgr) and not mgr.endswith("."):
        mgr = f"{mgr}."
    return mgr


def _split_audit_objects(value: str) -> List[str]:
    parts = [
        re.sub(r"\s+", " ", part).strip().rstrip(".")
        for part in re.split(r",\s*", value or "")
    ]
    return [part for part in parts if part]


def _split_managers(value: str) -> List[str]:
    managers: List[str] = []
    for part in re.split(r",\s*", value or ""):
        manager = _normalize_manager(part)
        if manager:
            managers.append(manager)
    return managers


def _format_single_responsible(audit_object: str, manager: str) -> str:
    name = re.sub(r"\s+", " ", (audit_object or "").strip()).rstrip(".")
    mgr = _normalize_manager(manager)
    if name and mgr:
        return f"{name} ({mgr})"
    return name or mgr


def format_responsible_from_pairs(pairs: List[Tuple[str, str]]) -> str:
    """Сформировать ответственных по каждому объекту аудита."""
    if not pairs:
        return ""

    if len(pairs) > 1:
        formatted = [_format_single_responsible(obj, mgr) for obj, mgr in pairs if obj or mgr]
        return ", ".join(formatted)

    audit_object, manager = pairs[0]
    objects = _split_audit_objects(audit_object)
    managers = _split_managers(manager)

    if len(objects) > 1 and len(managers) > 1:
        limit = min(len(objects), len(managers))
        formatted = [
            _format_single_responsible(objects[index], managers[index])
            for index in range(limit)
        ]
        for extra_object in objects[limit:]:
            formatted.append(_format_single_responsible(extra_object, ""))
        for extra_manager in managers[limit:]:
            formatted.append(_format_single_responsible("", extra_manager))
        return ", ".join(part for part in formatted if part)

    return _format_single_responsible(
        objects[0] if objects else audit_object,
        managers[0] if managers else manager,
    )


def _estimate_wrapped_lines(text: str, column_width: float) -> int:
    if not text:
        return 1

    chars_per_line = max(24, int(column_width * 1.05))
    lines = 0
    for paragraph in re.split(r"[\n\r]+", text):
        normalized = paragraph.strip()
        if not normalized:
            continue
        lines += max(1, (len(normalized) + chars_per_line - 1) // chars_per_line)
    return max(1, lines)


def _row_height_for_texts(texts_with_widths: List[Tuple[str, float]]) -> float:
    line_count = max(_estimate_wrapped_lines(text, width) for text, width in texts_with_widths)
    return min(409, max(_MIN_DATA_ROW_HEIGHT, line_count * _LINE_HEIGHT))


def _apply_worksheet_formatting(worksheet, *, last_row: int) -> None:
    for column, width in _COLUMN_WIDTHS.items():
        worksheet.column_dimensions[get_column_letter(column)].width = width

    for row in range(DATA_START_ROW, last_row + 1):
        check_name = worksheet.cell(row=row, column=COL_CHECK_NAME).value or ""
        recommendation = worksheet.cell(row=row, column=COL_RECOMMENDATION).value or ""
        responsible = worksheet.cell(row=row, column=COL_RESPONSIBLE).value or ""

        worksheet.row_dimensions[row].height = _row_height_for_texts([
            (str(check_name), _COLUMN_WIDTHS[COL_CHECK_NAME]),
            (str(recommendation), _COLUMN_WIDTHS[COL_RECOMMENDATION]),
            (str(responsible), _COLUMN_WIDTHS[COL_RESPONSIBLE]),
        ])

        for column in (
            COL_CHECK_NAME,
            COL_CHECK_LEADER,
            COL_RECOMMENDATION,
            COL_DEADLINE,
            COL_RESPONSIBLE,
        ):
            cell = worksheet.cell(row=row, column=column)
            if cell.value not in (None, ""):
                cell.alignment = _WRAPPED_TEXT_ALIGNMENT


def generate_control_file_template(
    input_path: str,
    output_path: str,
    *,
    check_leader: str,
    check_date: str,
) -> Tuple[Optional[str], Optional[str]]:
    """Сформировать xlsx-шаблон файла контроля из АЗ с Разделом II."""
    if not document_has_section_ii(input_path):
        return (
            None,
            "В документе не найден Раздел II. Загрузите АЗ с заполненным Разделом II.",
        )

    rows, parse_error = parse_section_ii_for_control_file(
        input_path,
        format_responsible_from_pairs=format_responsible_from_pairs,
    )
    if parse_error or rows is None:
        return None, parse_error or "Не удалось разобрать таблицу Раздела II."

    check_name, title_error = parse_az_title_from_docx(input_path)
    if title_error:
        return None, title_error

    if not TEMPLATE_PATH.is_file():
        return None, f"Шаблон не найден: {TEMPLATE_PATH.name}"

    shutil.copy2(TEMPLATE_PATH, output_path)
    workbook = load_workbook(output_path)
    worksheet = workbook.active

    for offset, item in enumerate(rows):
        row = DATA_START_ROW + offset
        worksheet.cell(row=row, column=COL_CHECK_DATE, value=check_date)
        worksheet.cell(row=row, column=COL_CHECK_NAME, value=check_name)
        worksheet.cell(row=row, column=COL_CHECK_LEADER, value=check_leader)
        worksheet.cell(row=row, column=COL_RECOMMENDATION, value=item.recommendation_text)
        worksheet.cell(row=row, column=COL_DEADLINE, value=item.deadline)
        worksheet.cell(row=row, column=COL_RESPONSIBLE, value=item.responsible)

    last_row = DATA_START_ROW + len(rows) - 1
    if rows:
        _apply_worksheet_formatting(worksheet, last_row=last_row)

    workbook.save(output_path)
    return output_path, None
