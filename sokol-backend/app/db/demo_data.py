# -*- coding: utf-8 -*-
"""Синтетические проверки и рекомендации для демо/seed (по правилам домена)."""

from __future__ import annotations

from datetime import date, timedelta

from app.utils.check_key import assign_serial_numbers

CHECK_TYPES = ("planned", "unscheduled", "thematic")
CHECK_VIEWS = ("ИТ", "бизнес", "риски", "корпоуправление", "иные")
CHECK_STATUSES = ("not_started", "in_progress", "completed")

REC_STATUSES = ("completed", "unresolved", "on_control", "in_progress")
REC_ADDITIONAL_STATUSES = ("on_time", "deadline_violated", "on_control")
MATERIALITY_LEVELS = ("низкий", "средний", "высокий")

STATUS_TO_INDICATOR = {
    "completed": "исполнено",
    "in_progress": "в процессе",
    "on_control": "ожидает",
    "unresolved": "не решено",
}

LEADERS = [
    "Иванов А.А.",
    "Петрова И.В.",
    "Смирнов К.П.",
    "Кузнецова Е.Н.",
    "Алексеев Д.С.",
    "Громова Т.В.",
    "Сорокин М.А.",
    "Белова О.И.",
    "Захаров П.П.",
    "Николаева Л.С.",
    "Фёдоров И.А.",
    "Ершова Н.П.",
    "Морозов С.Г.",
    "Орлова В.А.",
    "Соловьёв П.Н.",
    "Демидова И.Р.",
    "Пономарёв А.Д.",
    "Тимофеева Е.А.",
    "Лебедев В.Н.",
    "Важник Д.С.",
]

MANAGERS = [
    "Голец О.В.",
    "Кузнецов А.С.",
    "Сидоров В.И.",
    "Морозова Е.П.",
    "Федорова Н.К.",
]

AUDIT_OBJECTS = [
    "Департамент розничного бизнеса",
    "Департамент комплаенса",
    "Департамент ИТ",
    "Служба клиентского сервиса",
    "Финансовый департамент",
    "Архивный отдел",
    "Департамент рисков",
    "Департамент внутреннего аудита",
    "Контакт-центр",
    "Сеть филиалов",
    "Кредитный департамент",
]

CHECK_NAME_TEMPLATES = [
    "Комплексный аудит {topic}",
    "Проверка {topic}",
    "Контрольная: {topic}",
    "Аудит процессов {topic}",
    "Внеплановый аудит {topic}",
]

CHECK_TOPICS = [
    "клиентских процессов",
    "регуляторных требований",
    "качества данных",
    "обработки обращений",
    "корректности отчётности",
    "регламентов хранения",
    "клиентских рисков",
    "полноты данных в витринах",
    "обслуживания клиентов",
    "выполнения рекомендаций",
    "качества сервиса",
    "маршрутизации обращений",
    "процедур комплаенса",
    "процессов KYC",
    "автоматизированных проверок",
    "доступности сервисов",
    "филиальной сети",
    "данных клиентов",
    "выдачи кредитов",
    "операционных рисков",
]

REC_NAME_TEMPLATES = [
    "Внедрить контроль по направлению: {topic}",
    "Актуализировать регламент: {topic}",
    "Устранить несоответствия: {topic}",
    "Настроить мониторинг: {topic}",
    "Провести сверку: {topic}",
    "Оптимизировать процесс: {topic}",
    "Усилить контроль: {topic}",
    "Стандартизировать процедуры: {topic}",
]


def _add_days(base: date, days: int) -> date:
    return base + timedelta(days=days)


def build_check_rows(count: int = 100) -> list[dict]:
    if count < 1:
        raise ValueError("count must be >= 1")

    base = date(2025, 1, 6)
    rows: list[dict] = []
    for index in range(count):
        start = _add_days(base, index * 7)
        created = _add_days(start, -14)
        status = CHECK_STATUSES[index % len(CHECK_STATUSES)]
        check_type = CHECK_TYPES[index % len(CHECK_TYPES)]
        check_view = CHECK_VIEWS[index % len(CHECK_VIEWS)]
        leader = LEADERS[index % len(LEADERS)]
        topic = CHECK_TOPICS[index % len(CHECK_TOPICS)]
        name_template = CHECK_NAME_TEMPLATES[index % len(CHECK_NAME_TEMPLATES)]
        end_date = _add_days(start, 30) if status == "completed" else None
        n = index + 1
        rows.append(
            {
                "check_name": f"{name_template.format(topic=topic)} №{n}",
                "check_type": check_type,
                "check_view": check_view,
                "start_date": start,
                "end_date": end_date,
                "check_leader": leader,
                "status": status,
                "created_at": created,
                "description": f"Демо-проверка #{n}: оценка {topic}.",
                "order_document_number": f"ПР-{n:04d}" if index % 3 == 0 else None,
                "order_document_date": created if index % 3 == 0 else None,
                "program_document_number": f"ПГ-{n:04d}" if index % 4 == 0 else None,
                "program_document_date": _add_days(created, 3) if index % 4 == 0 else None,
                "az_document_number": f"АЗ-{n:04d}" if status == "completed" else None,
                "az_document_date": end_date if status == "completed" else None,
                "dz_document_number": f"ДЗ-{n:04d}" if status == "completed" and index % 2 == 0 else None,
                "dz_document_date": _add_days(end_date, 5) if status == "completed" and index % 2 == 0 and end_date else None,
            }
        )
    return assign_serial_numbers(rows)


def build_recommendation_rows(checks: list[dict], count: int = 100) -> list[dict]:
    if not checks:
        raise ValueError("checks must not be empty")
    if count < 1:
        raise ValueError("count must be >= 1")

    sequence_by_serial: dict[str, int] = {}
    rows: list[dict] = []
    for index in range(count):
        check = checks[index % len(checks)]
        serial = check["serial_number"]
        sequence_by_serial[serial] = sequence_by_serial.get(serial, 0) + 1
        status = REC_STATUSES[index % len(REC_STATUSES)]
        additional = REC_ADDITIONAL_STATUSES[index % len(REC_ADDITIONAL_STATUSES)]
        topic = CHECK_TOPICS[index % len(CHECK_TOPICS)]
        name_template = REC_NAME_TEMPLATES[index % len(REC_NAME_TEMPLATES)]
        n = index + 1
        created = _add_days(check["start_date"], 3)
        deadline = _add_days(created, 45 + (index % 30))
        name = f"{name_template.format(topic=topic)} №{n}"
        rows.append(
            {
                "serial_number": serial,
                "sequence_number": sequence_by_serial[serial],
                "name": name,
                "description": name,
                "indicator": STATUS_TO_INDICATOR[status],
                "materiality_level": MATERIALITY_LEVELS[index % len(MATERIALITY_LEVELS)],
                "audit_object": AUDIT_OBJECTS[index % len(AUDIT_OBJECTS)],
                "deadline": deadline,
                "auditor": check["check_leader"],
                "manager": MANAGERS[index % len(MANAGERS)],
                "status": status,
                "additional_status": additional,
                "created_at": created,
                "actual_completion_date": _add_days(deadline, -5) if status == "completed" else None,
                "closure_information": f"Демо-закрытие рекомендации #{n}" if status == "completed" else None,
            }
        )
    return rows
