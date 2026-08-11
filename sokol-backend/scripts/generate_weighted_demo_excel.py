#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генерация неравномерных демо-данных для аналитических дашбордов.

Скрипт создаёт XLSX-файлы в формате, который читает `app.db.import_seed_data`:

    python scripts/generate_weighted_demo_excel.py

По умолчанию будут созданы:
    data/checks.xlsx
    data/recommendations.xlsx
"""

from __future__ import annotations

import argparse
import random
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable, Sequence, TypeVar

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.worksheet.worksheet import Worksheet

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.auditor_names import AUDITORS as AUDITOR_NAMES  # noqa: E402
from app.utils.check_key import assign_serial_numbers  # noqa: E402

DEFAULT_DATA_DIR = ROOT / "data"

T = TypeVar("T")

CHECK_HEADERS = [
    "serial_number",
    "check_name",
    "short_name",
    "check_type",
    "check_view",
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

# Веса по убыванию — неравномерная нагрузка на аудиторов из справочника.
_AUDITOR_WEIGHTS = (28, 20, 16, 12, 10, 8, 6, 4, 3, 2, 1)
AUDITORS = [
    (name, _AUDITOR_WEIGHTS[index] if index < len(_AUDITOR_WEIGHTS) else 1)
    for index, name in enumerate(AUDITOR_NAMES)
]

MANAGERS = [
    ("Голец О.В.", 38),
    ("Кузнецов А.С.", 24),
    ("Сидоров В.И.", 18),
    ("Морозова Е.П.", 12),
    ("Федорова Н.К.", 8),
]

AUDIT_OBJECTS = [
    ("Департамент розничного бизнеса", 22),
    ("Департамент комплаенса", 18),
    ("Департамент ИТ", 15),
    ("Департамент рисков", 12),
    ("Сеть филиалов", 10),
    ("Кредитный департамент", 8),
    ("Финансовый департамент", 6),
    ("Служба клиентского сервиса", 4),
    ("Контакт-центр", 3),
    ("Архивный отдел", 2),
]

CHECK_TYPES = [("planned", 58), ("unscheduled", 24), ("thematic", 18)]
# Веса согласованы со справочником check_kinds (сумма = 100).
CHECK_VIEWS = [
    ("Корпо", 10),
    ("Розница", 10),
    ("Стратегия и финансы", 8),
    ("Риски", 12),
    ("ИТ", 12),
    ("Безопасность", 8),
    ("Комплаенс", 8),
    ("Процессинг, трансформация", 6),
    ("Маркетинг", 5),
    ("Управление делами", 4),
    ("АХД", 4),
    ("Кадры", 5),
    ("Мотивация", 3),
    ("Юристы", 3),
    ("Холдинг", 2),
]
CHECK_STATUSES = [("completed", 48), ("in_progress", 34), ("not_started", 18)]
REC_STATUSES = [("in_progress", 34), ("on_control", 27), ("completed", 25), ("unresolved", 14)]
MATERIALITY_LEVELS = [("средний", 47), ("высокий", 31), ("низкий", 22)]
# Согласовано со справочником effectiveness_ratings и матрицей аналитики.
EFFECTIVENESS_RATINGS = [
    ("эффективно", 26),
    ("достаточно эффективно", 22),
    ("недостаточно эффективно", 16),
    ("неэффективно", 12),
    ("не оценивалось", 12),
    ("", 12),
]

STATUS_TO_INDICATOR = {
    "completed": "исполнено",
    "in_progress": "в процессе",
    "on_control": "ожидает",
    "unresolved": "не решено",
}

TOPICS = [
    "контроля клиентских операций",
    "исполнения регуляторных требований",
    "качества данных в витринах",
    "маршрутизации клиентских обращений",
    "процедур KYC и комплаенса",
    "управления операционными рисками",
    "доступов к критичным системам",
    "процессов кредитного мониторинга",
    "документирования контрольных процедур",
    "качества отчётности филиальной сети",
    "закрытия ранее выданных рекомендаций",
    "хранения архивных документов",
]

REC_ACTIONS = [
    "Внедрить дополнительный контроль",
    "Актуализировать регламент",
    "Устранить выявленные несоответствия",
    "Настроить регулярный мониторинг",
    "Провести сверку и корректировку данных",
    "Оптимизировать контрольную процедуру",
    "Назначить ответственных за исправление",
    "Подготовить план корректирующих мероприятий",
]


def _weighted_choice(items: Sequence[tuple[T, int]]) -> T:
    values = [item[0] for item in items]
    weights = [item[1] for item in items]
    return random.choices(values, weights=weights, k=1)[0]


def _weighted_date() -> date:
    # Пики в Q4 2025 и Q2 2026 делают временные графики менее ровными.
    periods = [
        (date(2025, 1, 10), date(2025, 3, 31), 10),
        (date(2025, 4, 1), date(2025, 6, 30), 13),
        (date(2025, 7, 1), date(2025, 9, 30), 18),
        (date(2025, 10, 1), date(2025, 12, 25), 31),
        (date(2026, 1, 10), date(2026, 3, 31), 11),
        (date(2026, 4, 1), date(2026, 6, 30), 17),
    ]
    start, end, _weight = _weighted_choice([(period, period[2]) for period in periods])
    return start + timedelta(days=random.randint(0, (end - start).days))


def _format_distribution(values: Iterable[str]) -> str:
    counter = Counter(values)
    return ", ".join(f"{name}: {count}" for name, count in counter.most_common())


def _check_name(check_type: str, topic: str, index: int) -> str:
    prefix = {
        "planned": "Плановая проверка",
        "unscheduled": "Внеплановая проверка",
        "thematic": "Тематическая проверка",
    }[check_type]
    return (
        f"{prefix} {topic} №{index}. Анализируются ключевые контрольные точки, "
        "исполнительская дисциплина и качество подтверждающих документов."
    )[:255]


def _document_fields(index: int, status: str, created: date, start: date, end: date | None) -> dict:
    order_ready = random.random() < 0.86
    program_ready = random.random() < 0.72
    az_ready = status == "completed" and random.random() < 0.88
    dz_ready = az_ready and random.random() < 0.64
    return {
        "order_document_number": f"ПР-{index:04d}" if order_ready else None,
        "order_document_date": created + timedelta(days=random.randint(0, 5)) if order_ready else None,
        "program_document_number": f"ПГ-{index:04d}" if program_ready else None,
        "program_document_date": start - timedelta(days=random.randint(3, 12)) if program_ready else None,
        "az_document_number": f"АЗ-{index:04d}" if az_ready else None,
        "az_document_date": end if az_ready else None,
        "dz_document_number": f"ДЗ-{index:04d}" if dz_ready else None,
        "dz_document_date": end + timedelta(days=random.randint(3, 14)) if dz_ready and end else None,
    }


def build_checks(count: int) -> list[dict]:
    rows: list[dict] = []
    for index in range(1, count + 1):
        start = _weighted_date()
        status = _weighted_choice(CHECK_STATUSES)
        duration = random.randint(18, 55)
        end = start + timedelta(days=duration) if status == "completed" else None
        created = start - timedelta(days=random.randint(12, 35))
        check_type = _weighted_choice(CHECK_TYPES)
        check_view = _weighted_choice(CHECK_VIEWS)
        topic = random.choice(TOPICS)
        leader = _weighted_choice(AUDITORS)
        # У незавершённых проверок чаще нет оценок; у завершённых — почти всегда заполнены.
        if status == "not_started":
            rating_pool = [("", 70), ("эффективно", 10), ("достаточно эффективно", 10), ("недостаточно эффективно", 5), ("неэффективно", 5)]
        elif status == "in_progress":
            rating_pool = [("", 35), ("эффективно", 20), ("достаточно эффективно", 20), ("недостаточно эффективно", 15), ("неэффективно", 10)]
        else:
            rating_pool = EFFECTIVENESS_RATINGS
        row = {
            "check_name": _check_name(check_type, topic, index),
            "check_type": check_type,
            "check_view": check_view,
            "start_date": start,
            "end_date": end,
            "check_leader": leader,
            "status": status,
            "created_at": created,
            "description": f"Демо-проверка по направлению: {topic}.",
            "process_effectiveness": _weighted_choice(rating_pool) or None,
            "svk_effectiveness": _weighted_choice(rating_pool) or None,
            "sur_effectiveness": _weighted_choice(rating_pool) or None,
            "svik_effectiveness": _weighted_choice(rating_pool) or None,
        }
        row.update(_document_fields(index, status, created, start, end))
        rows.append(row)
    return assign_serial_numbers(rows)


def _recommendations_per_check(check: dict, index: int) -> int:
    base = {"completed": 1, "in_progress": 2, "not_started": 1}[check["status"]]
    if check["check_type"] == "unscheduled":
        base += random.choice([1, 2, 3])
    if check["check_view"] in {"ИТ", "Риски"}:
        base += random.choice([0, 1, 2])
    if index % 11 == 0:
        base += random.randint(3, 6)
    return max(base, 1)


def build_recommendations(checks: list[dict], target_count: int) -> list[dict]:
    sequence_by_serial: dict[str, int] = defaultdict(int)
    rows: list[dict] = []
    weighted_checks = sorted(checks, key=lambda row: row["start_date"])

    for check_index, check in enumerate(weighted_checks, start=1):
        for _ in range(_recommendations_per_check(check, check_index)):
            if len(rows) >= target_count:
                return rows
            sequence_by_serial[check["serial_number"]] += 1
            sequence = sequence_by_serial[check["serial_number"]]
            status = _weighted_choice(REC_STATUSES)
            materiality = _weighted_choice(MATERIALITY_LEVELS)
            audit_object = _weighted_choice(AUDIT_OBJECTS)
            topic = random.choice(TOPICS)
            created = check["start_date"] + timedelta(days=random.randint(2, 20))
            deadline_shift = random.choice([30, 45, 60, 75, 90, 120])
            deadline = created + timedelta(days=deadline_shift + random.randint(-7, 14))
            is_late = status in {"unresolved", "in_progress"} and random.random() < 0.42
            additional_status = (
                "deadline_violated"
                if is_late or status == "unresolved"
                else "on_time"
                if status == "completed"
                else "on_control"
            )
            completion_date = None
            if status == "completed":
                completion_date = deadline + timedelta(days=random.randint(-12, 18))
                additional_status = "deadline_violated" if completion_date > deadline else "on_time"

            action = random.choice(REC_ACTIONS)
            number = len(rows) + 1
            name = f"{action}: {topic} №{number}"
            rows.append(
                {
                    "serial_number": check["serial_number"],
                    "sequence_number": sequence,
                    "name": name,
                    "description": (
                        f"{name}. Рекомендация сформирована по результатам проверки "
                        f"и требует подтверждения ответственным подразделением."
                    ),
                    "indicator": STATUS_TO_INDICATOR[status],
                    "materiality_level": materiality,
                    "audit_object": audit_object,
                    "deadline": deadline,
                    "auditor": _weighted_choice(AUDITORS),
                    "manager": _weighted_choice(MANAGERS),
                    "status": status,
                    "additional_status": additional_status,
                    "created_at": created,
                    "actual_completion_date": completion_date,
                    "closure_information": (
                        f"Представлены подтверждающие материалы по рекомендации №{number}."
                        if completion_date
                        else None
                    ),
                }
            )

    while len(rows) < target_count:
        check = random.choice(checks)
        rows.extend(build_recommendations([check], target_count - len(rows)))
    return rows[:target_count]


def _write_sheet(workbook: Workbook, title: str, headers: list[str], rows: list[dict]) -> Worksheet:
    sheet = workbook.create_sheet(title)
    sheet.append(headers)
    for row in rows:
        sheet.append([row.get(header) for header in headers])
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    header_fill = PatternFill("solid", fgColor="C5D8FF")
    for cell in sheet[1]:
        cell.font = Font(bold=True)
        cell.fill = header_fill
    for column in sheet.columns:
        max_length = max(len(str(cell.value or "")) for cell in column)
        sheet.column_dimensions[column[0].column_letter].width = min(max(max_length + 2, 12), 42)
    return sheet


def _save_workbook(path: Path, sheet_name: str, headers: list[str], rows: list[dict]) -> None:
    workbook = Workbook()
    workbook.remove(workbook.active)
    _write_sheet(workbook, sheet_name, headers, rows)
    workbook.save(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate weighted demo XLSX files for SOKOL analytics.")
    parser.add_argument("--checks", type=int, default=120, help="Количество проверок")
    parser.add_argument("--recommendations", type=int, default=280, help="Количество рекомендаций")
    parser.add_argument("--seed", type=int, default=20260805, help="Seed для детерминированной генерации")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_DATA_DIR, help="Папка для checks.xlsx/recommendations.xlsx")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.checks < 1:
        raise ValueError("--checks must be >= 1")
    if args.recommendations < 1:
        raise ValueError("--recommendations must be >= 1")

    random.seed(args.seed)
    checks = build_checks(args.checks)
    recommendations = build_recommendations(checks, args.recommendations)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    checks_path = args.output_dir / "checks.xlsx"
    recommendations_path = args.output_dir / "recommendations.xlsx"
    _save_workbook(checks_path, "checks", CHECK_HEADERS, checks)
    _save_workbook(recommendations_path, "recommendations", RECOMMENDATION_HEADERS, recommendations)

    print(f"Created {checks_path}")
    print(f"Created {recommendations_path}")
    print(f"Checks: {len(checks)}")
    print(f"Recommendations: {len(recommendations)}")
    print(f"Check leaders: {_format_distribution(row['check_leader'] for row in checks)}")
    print(f"Recommendation auditors: {_format_distribution(row['auditor'] for row in recommendations)}")
    print(f"Audit objects: {_format_distribution(row['audit_object'] for row in recommendations)}")


if __name__ == "__main__":
    main()
