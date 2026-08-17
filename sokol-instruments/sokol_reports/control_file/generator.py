# -*- coding: utf-8 -*-
"""Парсинг АЗ под шаблон файла контроля (.xlsx)."""

import re
from pathlib import Path
import shutil
from typing import List, Optional, Tuple

from openpyxl import load_workbook

from sokol_reports.control_file.parser import parse_section_ii_for_control_file
from sokol_reports.control_file.title_parser import parse_az_title_from_docx
from sokol_reports.memorandum.parser import document_has_section_ii

TEMPLATE_PATH = Path(__file__).resolve().parents[2] / "data" / "файл контроля шаблон (шапка).xlsx"

COL_CHECK_NAME = 4
COL_CHECK_LEADER = 5
COL_RECOMMENDATION = 6
COL_DEADLINE = 9
COL_RESPONSIBLE = 10
DATA_START_ROW = 2
_MANAGER_INITIALS_RE = re.compile(
    r"^[А-ЯЁA-Z][а-яёa-z]+\s+[А-ЯЁA-Z]\.\s*[А-ЯЁA-Z]\.?$"
)


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


def _unique_preserve(values: List[str]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for value in values:
        key = value.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def format_responsible_from_pairs(pairs: List[Tuple[str, str]]) -> str:
    """Сформировать «Ответственные»: департаменты через запятую, затем ФИО в скобках."""
    objects: List[str] = []
    managers: List[str] = []
    for audit_object, manager in pairs:
        objects.extend(_split_audit_objects(audit_object))
        managers.extend(_split_managers(manager))

    objects = _unique_preserve(objects)
    managers = _unique_preserve(managers)

    if not objects and not managers:
        return ""
    if not managers:
        return ", ".join(objects)
    if not objects:
        return ", ".join(managers)
    return f"{', '.join(objects)} ({', '.join(managers)})"


def generate_control_file_template(input_path: str, output_path: str) -> Tuple[Optional[str], Optional[str]]:
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
        worksheet.cell(row=row, column=COL_CHECK_NAME, value=check_name)
        worksheet.cell(row=row, column=COL_RECOMMENDATION, value=item.recommendation_text)
        worksheet.cell(row=row, column=COL_DEADLINE, value=item.deadline)
        worksheet.cell(row=row, column=COL_RESPONSIBLE, value=item.responsible)

    workbook.save(output_path)
    return output_path, None
