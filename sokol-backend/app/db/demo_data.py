# -*- coding: utf-8 -*-
"""Синтетические проверки и рекомендации для демо/seed (по правилам домена)."""

from __future__ import annotations

from datetime import date, timedelta

from app.db.seed_check_kinds import CHECK_KINDS
from app.db.seed_effectiveness_ratings import EFFECTIVENESS_RATINGS
from app.utils.check_key import assign_serial_numbers

CHECK_TYPES = ("planned", "unscheduled", "thematic")
CHECK_VIEWS = tuple(CHECK_KINDS)
CHECK_STATUSES = ("not_started", "in_progress", "completed")
# Пустая строка тоже отображается как «не оценивалось» в матрице аналитики.
EFFECTIVENESS_DEMO_VALUES = (*EFFECTIVENESS_RATINGS, "")

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

# Названия ≥3 предложений, по типу проверки; длина ≤255 (лимит БД/схемы).
CHECK_NAME_TEMPLATES_BY_TYPE: dict[str, tuple[str, ...]] = {
    "planned": (
        (
            "Плановая проверка {topic} по утверждённому годовому плану внутреннего аудита. "
            "Оцениваются соблюдение регламентов и качество контрольных процедур. "
            "По итогам готовятся замечания и рекомендации по устранению недостатков."
        ),
        (
            "Плановый аудит {topic} согласно программе проверок на отчётный период. "
            "Проверяется соответствие процессов политикам и регуляторным требованиям. "
            "Результаты отражаются в акте с рисками и предложениями по усилению контроля."
        ),
        (
            "Плановая комплексная проверка {topic} по календарному графику аудита. "
            "Анализируются контрольные точки, документы и исполнительская дисциплина. "
            "На основе выводов формируются рекомендации и план последующего мониторинга."
        ),
    ),
    "unscheduled": (
        (
            "Внеплановая проверка {topic} по отдельному поручению руководства. "
            "Рассматриваются оперативные риски и основания для назначения проверки. "
            "Фиксируются нарушения, ответственные и первоочередные меры по устранению."
        ),
        (
            "Внеплановый аудит {topic}, инициированный по сигналам или инциденту. "
            "Проверяются факты отклонений, достаточность контролей и полнота реагирования. "
            "По результатам определяются срочные корректирующие действия."
        ),
        (
            "Внеплановая контрольная проверка {topic} вне графика плановых мероприятий. "
            "Оцениваются состояние процессов и последствия выявленных нарушений. "
            "Готовится оперативное заключение с рекомендациями по стабилизации."
        ),
    ),
    "thematic": (
        (
            "Тематическая проверка {topic} по выбранному направлению контроля. "
            "Анализируются профильные процессы, типовые отклонения и тематические контроли. "
            "Выводы используются для уточнения регламентов и усиления надзора."
        ),
        (
            "Тематический аудит {topic} в рамках целевого обзора области деятельности. "
            "Сопоставляются фактические практики с утверждёнными стандартами. "
            "По итогам формулируются рекомендации, ориентированные на данную тематику."
        ),
        (
            "Тематическая проверка {topic} с фокусом на однородные риски направления. "
            "Изучаются повторяющиеся ошибки, мониторинг и полнота отчётности по теме. "
            "Результаты служат основой для точечных улучшений процессов и контролей."
        ),
    ),
}

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


def _build_check_name(check_type: str, topic: str, n: int) -> str:
    templates = CHECK_NAME_TEMPLATES_BY_TYPE[check_type]
    template = templates[(n - 1) % len(templates)]
    name = template.format(topic=topic)
    suffix = f" №{n}"
    if len(name) + len(suffix) > 255:
        return name[: 255 - len(suffix)].rstrip() + suffix
    return name + suffix


CHECK_SHORT_NAME_BY_TYPE = {
    "planned": "Плановая проверка {topic}",
    "unscheduled": "Внеплановая проверка {topic}",
    "thematic": "Тематическая проверка {topic}",
}


def _build_check_short_name(check_type: str, topic: str, n: int) -> str:
    name = CHECK_SHORT_NAME_BY_TYPE[check_type].format(topic=topic)
    suffix = f" №{n}"
    if len(name) + len(suffix) > 255:
        return name[: 255 - len(suffix)].rstrip() + suffix
    return name + suffix


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
        end_date = _add_days(start, 30) if status == "completed" else None
        n = index + 1
        # Разные комбинации оценок по четырём областям, чтобы матрица была наглядной.
        process = EFFECTIVENESS_DEMO_VALUES[index % len(EFFECTIVENESS_DEMO_VALUES)]
        svk = EFFECTIVENESS_DEMO_VALUES[(index + 1) % len(EFFECTIVENESS_DEMO_VALUES)]
        sur = EFFECTIVENESS_DEMO_VALUES[(index + 2) % len(EFFECTIVENESS_DEMO_VALUES)]
        svik = EFFECTIVENESS_DEMO_VALUES[(index + 3) % len(EFFECTIVENESS_DEMO_VALUES)]
        if status == "not_started":
            process = svk = sur = svik = ""
        rows.append(
            {
                "check_name": _build_check_name(check_type, topic, n),
                "short_name": _build_check_short_name(check_type, topic, n),
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
                "process_effectiveness": process or None,
                "svk_effectiveness": svk or None,
                "sur_effectiveness": sur or None,
                "svik_effectiveness": svik or None,
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
