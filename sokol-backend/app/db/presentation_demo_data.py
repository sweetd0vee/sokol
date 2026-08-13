# -*- coding: utf-8 -*-
"""Генерация реалистичного презентационного демо-датасета (2025–2026)."""

from __future__ import annotations

import random
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.worksheet.worksheet import Worksheet

from app.db.auditor_names import AUDITORS
from app.db.department_names import DEPARTMENTS
from app.db.seed_check_kinds import CHECK_KINDS
from app.utils.check_key import assign_serial_numbers
from app.utils.paths import get_repo_data_dir

PRESENTATION_TODAY = date(2026, 8, 12)

CHECK_HEADERS = [
    "serial_number", "check_name", "short_name", "check_type", "check_view",
    "start_date", "end_date", "check_leader", "status", "created_at", "description",
    "order_document_number", "order_document_date",
    "program_document_number", "program_document_date",
    "az_document_number", "az_document_date",
    "dz_document_number", "dz_document_date",
    "process_effectiveness", "svk_effectiveness", "sur_effectiveness", "svik_effectiveness",
]

RECOMMENDATION_HEADERS = [
    "serial_number", "sequence_number", "name", "observation_name", "description", "indicator", "materiality_level",
    "audit_object", "deadline", "auditor", "manager", "status", "additional_status", "created_at",
    "actual_completion_date", "extension_1_reason", "extension_1_date", "extension_1_comment",
    "extension_2_reason", "extension_2_comment", "remove_from_control_reason",
    "remove_from_control_date", "remove_from_control_comment",
    "closure_verification_status", "closure_information",
]

MANAGERS = [
    "Голец О.В.", "Кузнецов А.С.", "Сидоров В.И.", "Морозова Е.П.", "Федорова Н.К.",
    "Петров И.Н.", "Смирнова Л.А.", "Новиков Д.В.", "Орлова М.С.", "Лебедев П.К.",
]

CHECK_TYPES = ("planned", "unscheduled", "thematic")
CHECK_TYPE_WEIGHTS = (55, 22, 23)

TOPICS = [
    "контроля клиентских операций",
    "исполнения регуляторных требований ЦБ",
    "качества данных в витринах и отчётности",
    "маршрутизации клиентских обращений",
    "процедур KYC и комплаенса",
    "управления операционными рисками",
    "доступов к критичным ИТ-системам",
    "процессов кредитного мониторинга",
    "документирования контрольных процедур",
    "качества отчётности филиальной сети",
    "закрытия ранее выданных рекомендаций",
    "хранения архивных документов",
    "платёжных операций и процессинга",
    "антифрод-контролей",
    "управления ИТ-изменениями",
    "сегментации клиентской базы",
    "взыскания просроченной задолженности",
    "управления ликвидностью",
]

REC_TEMPLATES = [
    "Внедрить дополнительный контроль по направлению: {topic}",
    "Актуализировать регламент в части {topic}",
    "Устранить выявленные несоответствия при {topic}",
    "Настроить регулярный мониторинг показателей {topic}",
    "Провести сверку и корректировку данных по {topic}",
    "Оптимизировать контрольную процедуру {topic}",
    "Назначить ответственных за исправление в зоне {topic}",
    "Подготовить план корректирующих мероприятий по {topic}",
    "Усилить разграничение полномочий при {topic}",
    "Обеспечить документирование результатов {topic}",
]

OBSERVATION_TEMPLATES = [
    "Недостатки в организации процесса {topic}",
    "Неполное документирование контрольных процедур по направлению {topic}",
    "Несвоевременное обновление регламентов в части {topic}",
    "Отсутствие единого владельца процесса {topic}",
    "Недостаточная автоматизация мониторинга показателей {topic}",
    "Нарушение сроков проведения контрольных мероприятий по {topic}",
    "Недостатки разграничения полномочий при {topic}",
    "Неполная сверка данных и отчётности по {topic}",
]

STATUS_TO_INDICATOR = {
    "completed": "исполнено",
    "in_progress": "в процессе",
    "on_control": "ожидает",
    "unresolved": "не решено",
}

EFFECTIVENESS_VALUES = [
    "эффективно", "достаточно эффективно", "недостаточно эффективно",
    "неэффективно", "не оценивалось",
]


def _check_name(check_type: str, topic: str, index: int) -> str:
    prefix = {"planned": "Плановая проверка", "unscheduled": "Внеплановая проверка", "thematic": "Тематическая проверка"}[check_type]
    text = (
        f"{prefix} {topic} №{index}. Оцениваются ключевые контрольные точки, "
        "исполнительская дисциплина и качество подтверждающих документов."
    )
    return text[:255]


def _short_name(check_type: str, topic: str, index: int) -> str:
    prefix = {"planned": "Плановая", "unscheduled": "Внеплановая", "thematic": "Тематическая"}[check_type]
    return f"{prefix} проверка {topic} №{index}"[:255]


def _resolve_check_status(start: date, end: date | None, today: date) -> str:
    if end is not None and end <= today:
        return "completed"
    if start > today:
        return "not_started"
    return "in_progress"


def _pick_effectiveness(status: str, rng: random.Random) -> tuple[str | None, str | None, str | None, str | None]:
    if status != "completed":
        if rng.random() < 0.25:
            return (rng.choice(EFFECTIVENESS_VALUES), None, None, None)
        return (None, None, None, None)
    return (
        rng.choice(EFFECTIVENESS_VALUES),
        rng.choice(EFFECTIVENESS_VALUES),
        rng.choice(EFFECTIVENESS_VALUES),
        rng.choice(EFFECTIVENESS_VALUES),
    )


def _document_fields(index: int, status: str, created: date, start: date, end: date | None, rng: random.Random) -> dict:
    order_ready = status != "not_started" and rng.random() < 0.92
    program_ready = status != "not_started" and rng.random() < 0.85
    az_ready = status == "completed" and rng.random() < 0.9
    dz_ready = az_ready and rng.random() < 0.7
    return {
        "order_document_number": f"ПР-{index:04d}" if order_ready else None,
        "order_document_date": created + timedelta(days=rng.randint(0, 5)) if order_ready else None,
        "program_document_number": f"ПГ-{index:04d}" if program_ready else None,
        "program_document_date": start - timedelta(days=rng.randint(3, 14)) if program_ready else None,
        "az_document_number": f"АЗ-{index:04d}" if az_ready else None,
        "az_document_date": end if az_ready else None,
        "dz_document_number": f"ДЗ-{index:04d}" if dz_ready else None,
        "dz_document_date": end + timedelta(days=rng.randint(5, 21)) if dz_ready and end else None,
    }


def _schedule_check_dates(year: int, rng: random.Random, today: date) -> tuple[date, date | None]:
    if year == 2025:
        start = date(year, rng.randint(1, 12), rng.randint(1, 28))
    else:
        month = rng.randint(1, 10)
        day = rng.randint(1, 28)
        start = date(year, month, day)
        if start > today + timedelta(days=30):
            start = today - timedelta(days=rng.randint(5, 60))

    duration = rng.choice([45, 60, 75, 90, 105, 120])
    if rng.random() < 0.2:
        duration = rng.randint(21, 44)
    end = start + timedelta(days=duration)
    status = _resolve_check_status(start, end, today)
    if status == "in_progress":
        end = None
    elif status == "not_started":
        end = None
        if start <= today:
            start = today + timedelta(days=rng.randint(7, 45))
    return start, end


def build_checks(
    *,
    checks_2025: int,
    checks_2026: int,
    today: date,
    rng: random.Random,
) -> list[dict]:
    rows: list[dict] = []
    leader_weights = {name: 1 for name in AUDITORS}
    leader_weights["Важник Д.С."] = 3
    leader_weights["Харитонов А.И."] = 2
    leader_weights["Крейзо В.С."] = 2
    weighted_leaders = [(name, leader_weights[name]) for name in AUDITORS]

    index = 0
    for year, count in ((2025, checks_2025), (2026, checks_2026)):
        for _ in range(count):
            index += 1
            start, end = _schedule_check_dates(year, rng, today)
            status = _resolve_check_status(start, end, today)
            created = start - timedelta(days=rng.randint(14, 40))
            check_type = rng.choices(CHECK_TYPES, weights=CHECK_TYPE_WEIGHTS, k=1)[0]
            check_view = rng.choice(CHECK_KINDS)
            topic = rng.choice(TOPICS)
            leader = rng.choices([n for n, _ in weighted_leaders], weights=[w for _, w in weighted_leaders], k=1)[0]
            pe, svk, sur, svik = _pick_effectiveness(status, rng)
            row = {
                "check_name": _check_name(check_type, topic, index),
                "short_name": _short_name(check_type, topic, index),
                "check_type": check_type,
                "check_view": check_view,
                "start_date": start,
                "end_date": end,
                "check_leader": leader,
                "status": status,
                "created_at": created,
                "description": f"Проверка {year} г.: {topic}. Руководитель — {leader}.",
                "process_effectiveness": pe,
                "svk_effectiveness": svk,
                "sur_effectiveness": sur,
                "svik_effectiveness": svik,
            }
            row.update(_document_fields(index, status, created, start, end, rng))
            rows.append(row)

    rows.sort(key=lambda item: item["start_date"])
    return assign_serial_numbers(rows)


def _pick_audit_object(rng: random.Random) -> str:
    if rng.random() < 0.14:
        first, second = rng.sample(DEPARTMENTS, 2)
        return f"{first}; {second}"
    return rng.choice(DEPARTMENTS)


def _recommendation_status(rng: random.Random, deadline: date, today: date) -> tuple[str, str]:
    roll = rng.random()
    if roll < 0.38:
        status = "completed"
    elif roll < 0.68:
        status = "in_progress"
    elif roll < 0.86:
        status = "on_control"
    else:
        status = "unresolved"

    if status == "completed":
        additional = "deadline_violated" if rng.random() < 0.22 else "on_time"
    elif status == "unresolved":
        additional = "deadline_violated"
    elif deadline < today and status in {"in_progress", "on_control"}:
        additional = "deadline_violated" if rng.random() < 0.55 else "on_control"
    else:
        additional = "on_control" if status == "on_control" else "on_time"
    return status, additional


def build_recommendations(checks: list[dict], rng: random.Random, today: date) -> list[dict]:
    rows: list[dict] = []
    materiality_weights = [("низкий", 28), ("средний", 48), ("высокий", 24)]

    for check in checks:
        rec_count = rng.randint(30, 50)
        for sequence in range(1, rec_count + 1):
            materiality = rng.choices([m for m, _ in materiality_weights], weights=[w for _, w in materiality_weights], k=1)[0]
            topic = rng.choice(TOPICS)
            template = rng.choice(REC_TEMPLATES)
            observation_name = rng.choice(OBSERVATION_TEMPLATES).format(topic=topic)
            created = check["start_date"] + timedelta(days=rng.randint(5, 35))
            deadline = created + timedelta(days=rng.choice([45, 60, 75, 90, 120, 150]))
            status, additional_status = _recommendation_status(rng, deadline, today)

            completion_date = None
            closure_information = None
            if status == "completed":
                offset = rng.randint(-20, 25)
                completion_date = deadline + timedelta(days=offset)
                closure_information = "Представлены подтверждающие материалы и акт проверки исполнения."
                if completion_date > deadline:
                    additional_status = "deadline_violated"

            name = f"{template.format(topic=topic)} (п.{sequence})"
            rows.append({
                "serial_number": check["serial_number"],
                "sequence_number": sequence,
                "name": name[:500],
                "observation_name": observation_name[:500],
                "description": (
                    f"{name}. Наблюдение: {observation_name}. Рекомендация выдана по итогам проверки "
                    f"{check['short_name'] or check['check_name'][:80]}."
                ),
                "indicator": STATUS_TO_INDICATOR[status],
                "materiality_level": materiality,
                "audit_object": _pick_audit_object(rng),
                "deadline": deadline,
                "auditor": check["check_leader"],
                "manager": rng.choice(MANAGERS),
                "status": status,
                "additional_status": additional_status,
                "created_at": created,
                "actual_completion_date": completion_date,
                "closure_information": closure_information,
            })
    return rows


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
        sheet.column_dimensions[column[0].column_letter].width = min(max(max_length + 2, 12), 48)
    return sheet


def _save_workbook(path: Path, sheet_name: str, headers: list[str], rows: list[dict]) -> None:
    workbook = Workbook()
    workbook.remove(workbook.active)
    _write_sheet(workbook, sheet_name, headers, rows)
    workbook.save(path)


def generate_presentation_dataset(
    *,
    output_dir: Path | None = None,
    checks_2025: int = 18,
    checks_2026: int = 11,
    seed: int = 20260812,
    today: date | None = None,
) -> tuple[list[dict], list[dict]]:
    today = today or PRESENTATION_TODAY
    rng = random.Random(seed)
    checks = build_checks(checks_2025=checks_2025, checks_2026=checks_2026, today=today, rng=rng)
    recommendations = build_recommendations(checks, rng, today)

    target_dir = output_dir or get_repo_data_dir()
    target_dir.mkdir(parents=True, exist_ok=True)
    _save_workbook(target_dir / "checks.xlsx", "checks", CHECK_HEADERS, checks)
    _save_workbook(target_dir / "recommendations.xlsx", "recommendations", RECOMMENDATION_HEADERS, recommendations)

    print(f"Checks: {len(checks)} (2025: {checks_2025}, 2026: {checks_2026})")
    print(f"Recommendations: {len(recommendations)} (avg {len(recommendations) // max(len(checks), 1)} per check)")
    print(f"Leaders: {dict(Counter(row['check_leader'] for row in checks))}")
    print(f"Check statuses: {dict(Counter(row['status'] for row in checks))}")
    print(f"Rec statuses: {dict(Counter(row['status'] for row in recommendations))}")
    dual = sum(1 for row in recommendations if ";" in row["audit_object"])
    print(f"Dual-department recommendations: {dual}")
    return checks, recommendations
