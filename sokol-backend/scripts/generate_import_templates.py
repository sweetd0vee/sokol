#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Пустые XLSX-шаблоны (только шапка) для ручного ввода исторических данных.

Формат совместим с `app.db.import_seed_data` (имена листов и колонок = поля БД).

Запуск из корня репозитория или из sokol-backend:

    python sokol-backend/scripts/generate_import_templates.py

По умолчанию создаёт в data/templates/:
  - checks_template.xlsx / recommendations_template.xlsx
  - checks_YYYY.xlsx / recommendations_YYYY.xlsx за последние 3 полных года
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.seed_check_kinds import CHECK_KINDS  # noqa: E402
from app.db.seed_effectiveness_ratings import EFFECTIVENESS_RATINGS  # noqa: E402

DEFAULT_OUT_DIR = ROOT / "data" / "templates"

# Актуальные колонки под import_seed_data / модели Check и Recommendation.
CHECK_HEADERS = [
    "serial_number",
    "check_name",
    "short_name",
    "check_type",
    "check_view",
    "check_quarter",
    "start_date",
    "end_date",
    "check_leader",
    "status",
    "created_at",
    "description",
    "order_document_number",
    "order_document_date",
    "program_document_number",
    "program_document_date",
    "az_document_number",
    "az_document_date",
    "dz_document_number",
    "dz_document_date",
    "process_effectiveness",
    "svk_effectiveness",
    "sur_effectiveness",
    "svik_effectiveness",
]

RECOMMENDATION_HEADERS = [
    "serial_number",
    "sequence_number",
    "name",
    "description",
    "indicator",
    "materiality_level",
    "audit_object",
    "deadline",
    "auditor",
    "manager",
    "status",
    "additional_status",
    "created_at",
    "actual_completion_date",
    "extension_1_reason",
    "extension_1_date",
    "extension_1_comment",
    "extension_2_reason",
    "extension_2_comment",
    "remove_from_control_reason",
    "remove_from_control_date",
    "remove_from_control_comment",
    "closure_verification_status",
    "closure_information",
]

HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HEADER_FONT = Font(color="FFFFFF", bold=True, name="Calibri", size=11)
HINT_FILL = PatternFill("solid", fgColor="D6EAF8")
REQUIRED_FILL = PatternFill("solid", fgColor="FCE4D6")

CHECK_COLUMN_META: list[tuple[str, bool, str]] = [
    ("serial_number", True, "Ключ проверки (уникальный). Пример: 24IAA3P1 = год+код аудитора+квартал+тип+номер"),
    ("check_name", True, "Полное наименование проверки (до 255 символов)"),
    ("short_name", False, "Краткое имя для таблиц/аналитики"),
    ("check_type", True, "planned | unscheduled | thematic"),
    ("check_view", True, "Вид из справочника (см. лист «справочники»)"),
    ("check_quarter", True, "Квартал проверки: 1 | 2 | 3 | 4"),
    ("start_date", True, "Дата начала YYYY-MM-DD"),
    ("end_date", False, "Дата окончания YYYY-MM-DD"),
    ("check_leader", True, "ФИО руководителя проверки"),
    ("status", True, "not_started | in_progress | completed"),
    ("created_at", False, "Дата создания записи YYYY-MM-DD (по умолчанию — сегодня при импорте)"),
    ("description", False, "Описание / цель проверки"),
    ("order_document_number", False, "Номер приказа"),
    ("order_document_date", False, "Дата приказа YYYY-MM-DD"),
    ("program_document_number", False, "Номер программы"),
    ("program_document_date", False, "Дата программы YYYY-MM-DD"),
    ("az_document_number", False, "Номер аудиторского заключения"),
    ("az_document_date", False, "Дата АЗ YYYY-MM-DD"),
    ("dz_document_number", False, "Номер докладной записки"),
    ("dz_document_date", False, "Дата ДЗ YYYY-MM-DD"),
    ("process_effectiveness", False, "Оценка процесса (см. справочники)"),
    ("svk_effectiveness", False, "Оценка СВК"),
    ("sur_effectiveness", False, "Оценка СУР"),
    ("svik_effectiveness", False, "Оценка СВИК"),
]

RECOMMENDATION_COLUMN_META: list[tuple[str, bool, str]] = [
    ("serial_number", True, "Ключ проверки — должен совпадать с checks.serial_number"),
    ("sequence_number", True, "Порядковый номер рекомендации внутри проверки (1, 2, …)"),
    ("name", True, "Краткое название рекомендации"),
    ("description", False, "Полный текст; если пусто — копируется name"),
    ("indicator", False, "не указан | в процессе | на контроле | не решено | исполнено"),
    ("materiality_level", False, "низкий | средний | высокий (по умолчанию средний)"),
    ("audit_object", True, "Объект аудита / подразделение"),
    ("deadline", False, "Срок исполнения YYYY-MM-DD"),
    ("auditor", True, "ФИО аудитора"),
    ("manager", True, "ФИО менеджера / ответственного"),
    ("status", True, "completed | unresolved | on_control | in_progress"),
    ("additional_status", True, "on_time | deadline_violated | on_control"),
    ("created_at", False, "Дата создания YYYY-MM-DD"),
    ("actual_completion_date", False, "Фактическая дата исполнения YYYY-MM-DD"),
    ("extension_1_reason", False, "Причина 1-го продления срока"),
    ("extension_1_date", False, "Дата 1-го продления YYYY-MM-DD"),
    ("extension_1_comment", False, "Комментарий к 1-му продлению"),
    ("extension_2_reason", False, "Причина 2-го продления"),
    ("extension_2_comment", False, "Комментарий ко 2-му продлению"),
    ("remove_from_control_reason", False, "Причина снятия с контроля"),
    ("remove_from_control_date", False, "Дата снятия с контроля YYYY-MM-DD"),
    ("remove_from_control_comment", False, "Комментарий к снятию с контроля"),
    ("closure_verification_status", False, "Статус верификации закрытия"),
    ("closure_information", False, "Информация о закрытии / подтверждении"),
]


def _style_header(sheet, headers: list[str], required: set[str]) -> None:
    for index, header in enumerate(headers, start=1):
        cell = sheet.cell(1, index, header)
        if header in required:
            cell.font = Font(bold=True, name="Calibri", size=11)
            cell.fill = REQUIRED_FILL
        else:
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", wrap_text=True, vertical="center")
    sheet.row_dimensions[1].height = 28
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"
    for index, header in enumerate(headers, start=1):
        width = max(14, min(28, len(header) + 4))
        sheet.column_dimensions[get_column_letter(index)].width = width


def _write_meta_sheet(workbook: Workbook, title: str, meta: list[tuple[str, bool, str]]) -> None:
    sheet = workbook.create_sheet(title)
    sheet.append(["column", "required", "description"])
    for col, required, description in meta:
        sheet.append([col, "да" if required else "нет", description])
    for cell in sheet[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
    sheet.column_dimensions["A"].width = 32
    sheet.column_dimensions["B"].width = 12
    sheet.column_dimensions["C"].width = 80
    sheet.freeze_panes = "A2"


def _write_guides_sheet(workbook: Workbook, years: list[int]) -> None:
    sheet = workbook.create_sheet("инструкция", 0)
    years_text = ", ".join(str(y) for y in years)
    lines = [
        ("Шаблоны загрузки исторических данных SOKOL", ""),
        ("", ""),
        ("Назначение", "Ручное заполнение проверок и рекомендаций за исторический период для последующего импорта в БД."),
        ("Годы шаблонов", years_text),
        ("Даты", "Формат YYYY-MM-DD (например 2024-03-15). Можно вводить как дату Excel."),
        ("Лист данных", "Имя листа должно оставаться checks или recommendations — иначе импорт не найдёт данные."),
        ("Строка 1", "Не переименовывайте заголовки колонок — это имена полей БД."),
        ("Обязательные", "Колонки с оранжевой шапкой обязательны при импорте."),
        ("Ключ проверки", "serial_number уникален. Рекомендации ссылаются на тот же serial_number."),
        ("Связь", "Сначала заполните/импортируйте checks, затем recommendations с теми же ключами."),
        (
            "Импорт",
            "DATABASE_URL=... python -m app.db.import_seed_data --checks PATH --recommendations PATH [--replace]",
        ),
        (
            "Демо-файлы",
            "data/checks.xlsx и data/recommendations.xlsx — синтетика; шаблоны лежат в data/templates/.",
        ),
        ("", ""),
        ("check_type", "planned=Плановая, unscheduled=Внеплановая, thematic=Контрольная"),
        ("status (проверка)", "not_started=Запланировано, in_progress=В процессе, completed=Завершено"),
        ("status (рекомендация)", "completed | unresolved | on_control | in_progress"),
        ("additional_status", "on_time | deadline_violated | on_control"),
    ]
    for row_index, (left, right) in enumerate(lines, start=1):
        sheet.cell(row_index, 1, left).font = Font(
            bold=bool(right == "" and left),
            size=12 if row_index == 1 else 11,
        )
        sheet.cell(row_index, 2, right)
        if row_index == 1:
            sheet.cell(row_index, 1).fill = HINT_FILL
    sheet.column_dimensions["A"].width = 28
    sheet.column_dimensions["B"].width = 100


def _write_directories_sheet(workbook: Workbook) -> None:
    sheet = workbook.create_sheet("справочники")
    sheet.append(["check_view", "effectiveness", "indicator", "materiality_level"])
    for cell in sheet[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL

    max_len = max(len(CHECK_KINDS), len(EFFECTIVENESS_RATINGS), 5, 3)
    indicators = ["не указан", "в процессе", "на контроле", "не решено", "исполнено"]
    materiality = ["низкий", "средний", "высокий"]
    for index in range(max_len):
        sheet.append(
            [
                CHECK_KINDS[index] if index < len(CHECK_KINDS) else None,
                EFFECTIVENESS_RATINGS[index] if index < len(EFFECTIVENESS_RATINGS) else None,
                indicators[index] if index < len(indicators) else None,
                materiality[index] if index < len(materiality) else None,
            ]
        )
    for letter in "ABCD":
        sheet.column_dimensions[letter].width = 28


def _add_check_validations(sheet, *, view_rows: int, eff_rows: int) -> None:
    """Списки через лист «справочники», чтобы значения с запятыми не ломали DV."""
    type_dv = DataValidation(
        type="list",
        formula1='"planned,unscheduled,thematic"',
        allow_blank=True,
    )
    status_dv = DataValidation(
        type="list",
        formula1='"not_started,in_progress,completed"',
        allow_blank=True,
    )
    view_dv = DataValidation(
        type="list",
        formula1=f"справочники!$A$2:$A${view_rows}",
        allow_blank=True,
    )
    eff_dv = DataValidation(
        type="list",
        formula1=f"справочники!$B$2:$B${eff_rows}",
        allow_blank=True,
    )
    sheet.add_data_validation(type_dv)
    sheet.add_data_validation(status_dv)
    sheet.add_data_validation(view_dv)
    sheet.add_data_validation(eff_dv)
    type_dv.add("D2:D5000")
    status_dv.add("I2:I5000")
    view_dv.add("E2:E5000")
    for col in ("T", "U", "V", "W"):
        eff_dv.add(f"{col}2:{col}5000")


def _add_recommendation_validations(sheet) -> None:
    indicator_dv = DataValidation(
        type="list",
        formula1="справочники!$C$2:$C$6",
        allow_blank=True,
    )
    materiality_dv = DataValidation(
        type="list",
        formula1="справочники!$D$2:$D$4",
        allow_blank=True,
    )
    status_dv = DataValidation(
        type="list",
        formula1='"completed,unresolved,on_control,in_progress"',
        allow_blank=True,
    )
    additional_dv = DataValidation(
        type="list",
        formula1='"on_time,deadline_violated,on_control"',
        allow_blank=True,
    )
    for dv in (indicator_dv, materiality_dv, status_dv, additional_dv):
        sheet.add_data_validation(dv)
    indicator_dv.add("E2:E5000")
    materiality_dv.add("F2:F5000")
    status_dv.add("K2:K5000")
    additional_dv.add("L2:L5000")


def build_checks_workbook(years: list[int]) -> Workbook:
    workbook = Workbook()
    workbook.remove(workbook.active)
    _write_guides_sheet(workbook, years)
    _write_directories_sheet(workbook)
    sheet = workbook.create_sheet("checks")
    sheet.append(CHECK_HEADERS)
    required = {name for name, is_required, _ in CHECK_COLUMN_META if is_required}
    _style_header(sheet, CHECK_HEADERS, required)
    _add_check_validations(
        sheet,
        view_rows=1 + len(CHECK_KINDS),
        eff_rows=1 + len(EFFECTIVENESS_RATINGS),
    )
    _write_meta_sheet(workbook, "колонки", CHECK_COLUMN_META)
    return workbook


def build_recommendations_workbook(years: list[int]) -> Workbook:
    workbook = Workbook()
    workbook.remove(workbook.active)
    _write_guides_sheet(workbook, years)
    _write_directories_sheet(workbook)
    sheet = workbook.create_sheet("recommendations")
    sheet.append(RECOMMENDATION_HEADERS)
    required = {name for name, is_required, _ in RECOMMENDATION_COLUMN_META if is_required}
    _style_header(sheet, RECOMMENDATION_HEADERS, required)
    _add_recommendation_validations(sheet)
    _write_meta_sheet(workbook, "колонки", RECOMMENDATION_COLUMN_META)
    return workbook


def historical_years(as_of: date | None = None, count: int = 3) -> list[int]:
    """Последние `count` полных календарных лет относительно as_of (по умолчанию сегодня)."""
    today = as_of or date.today()
    last_full = today.year - 1
    return list(range(last_full - count + 1, last_full + 1))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate empty SOKOL import XLSX templates.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Каталог для шаблонов (default: data/templates)",
    )
    parser.add_argument(
        "--years",
        type=int,
        nargs="*",
        default=None,
        help="Годы для помеченных файлов (default: 3 последних полных года)",
    )
    args = parser.parse_args()

    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    years = args.years or historical_years()

    checks_blank = out_dir / "checks_template.xlsx"
    recs_blank = out_dir / "recommendations_template.xlsx"
    build_checks_workbook(years).save(checks_blank)
    build_recommendations_workbook(years).save(recs_blank)
    print(f"Created {checks_blank}")
    print(f"Created {recs_blank}")

    for year in years:
        checks_path = out_dir / f"checks_{year}.xlsx"
        recs_path = out_dir / f"recommendations_{year}.xlsx"
        build_checks_workbook(years).save(checks_path)
        build_recommendations_workbook(years).save(recs_path)
        print(f"Created {checks_path}")
        print(f"Created {recs_path}")

    print(f"Years: {years}")
    print("Orange header = required column. Keep sheet names: checks / recommendations.")


if __name__ == "__main__":
    main()
