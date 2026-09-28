"""Парсинг АЗ под шаблон файла контроля (.xlsx)."""

from __future__ import annotations

import re
import shutil

from openpyxl import load_workbook
from openpyxl.styles import Alignment
from openpyxl.utils import get_column_letter

from sokol_reports.control_file.parser import parse_section_ii_for_control_file
from sokol_reports.control_file.responsible import format_responsible_from_pairs
from sokol_reports.control_file.title_parser import parse_az_title_from_docx
from sokol_reports.memorandum.parser import document_has_section_ii
from sokol_reports.paths import CONTROL_FILE_TEMPLATE

COL_CHECK_NAME = 4
COL_CHECK_LEADER = 5
COL_RECOMMENDATION = 6
COL_DEADLINE = 9
COL_RESPONSIBLE = 10
DATA_START_ROW = 2
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

__all__ = [
    "COL_CHECK_LEADER",
    "COL_CHECK_NAME",
    "COL_DEADLINE",
    "COL_RECOMMENDATION",
    "COL_RESPONSIBLE",
    "format_responsible_from_pairs",
    "generate_control_file_template",
]


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


def _row_height_for_texts(texts_with_widths: list[tuple[str, float]]) -> float:
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

        for column in (COL_CHECK_NAME, COL_CHECK_LEADER, COL_RECOMMENDATION, COL_DEADLINE, COL_RESPONSIBLE):
            cell = worksheet.cell(row=row, column=column)
            if cell.value not in (None, ""):
                cell.alignment = _WRAPPED_TEXT_ALIGNMENT


def generate_control_file_template(input_path: str, output_path: str) -> tuple[str | None, str | None]:
    """Сформировать xlsx-шаблон файла контроля из Аудиторского Заключения с Разделом II.

    Args:
        input_path: Путь к исходному .docx (АЗ с заполненным Разделом II).
        output_path: Путь для сохранения результата (.xlsx).

    Returns:
        Кортеж (путь к результату, сообщение об ошибке). При успехе error — None.
    """
    if not document_has_section_ii(input_path):
        return (
            None,
            "В документе не найден Раздел II. Загрузите АЗ с заполненным Разделом II.",
        )

    rows, parse_error = parse_section_ii_for_control_file(input_path)
    if parse_error or rows is None:
        return None, parse_error or "Не удалось разобрать таблицу Раздела II."

    check_name, title_error = parse_az_title_from_docx(input_path)
    if title_error:
        return None, title_error

    if not CONTROL_FILE_TEMPLATE.is_file():
        return None, f"Шаблон не найден: {CONTROL_FILE_TEMPLATE.name}"

    shutil.copy2(CONTROL_FILE_TEMPLATE, output_path)
    workbook = load_workbook(output_path)
    worksheet = workbook.active

    for offset, item in enumerate(rows):
        row = DATA_START_ROW + offset
        worksheet.cell(row=row, column=COL_CHECK_NAME, value=check_name)
        worksheet.cell(row=row, column=COL_RECOMMENDATION, value=item.recommendation_text)
        worksheet.cell(row=row, column=COL_DEADLINE, value=item.deadline)
        worksheet.cell(row=row, column=COL_RESPONSIBLE, value=item.responsible)

    last_row = DATA_START_ROW + len(rows) - 1
    if rows:
        _apply_worksheet_formatting(worksheet, last_row=last_row)

    workbook.save(output_path)
    return output_path, None
