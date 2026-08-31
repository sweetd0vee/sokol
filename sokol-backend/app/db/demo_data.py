# -*- coding: utf-8 -*-
"""Синтетические проверки и рекомендации для демо/seed (по правилам домена)."""

from __future__ import annotations

import random
from datetime import date, timedelta

from app.db.auditor_names import AUDITORS
from app.db.department_names import DEPARTMENTS
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
    "on_control": "на контроле",
    "unresolved": "не решено",
}

ADDITIONAL_STATUS_TO_INDICATOR = {
    "on_time": "в срок",
    "deadline_violated": "срок нарушен",
    "on_control": "на контроле",
}

# Руководители проверок / аудиторы = актуальный справочник auditors.
LEADERS = tuple(AUDITORS)

MANAGERS = [
    "Голец О.В.",
    "Кузнецов А.С.",
    "Сидоров В.И.",
    "Морозова Е.П.",
    "Федорова Н.К.",
]

AUDIT_OBJECTS = list(DEPARTMENTS)

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

OBSERVATION_NAME_TEMPLATES = [
    "Недостатки в процессе {topic}",
    "Неполное документирование процедур по {topic}",
    "Несвоевременное обновление регламентов {topic}",
    "Отсутствие регулярного контроля по направлению {topic}",
    "Недостаточная сверка данных при {topic}",
    "Нарушение сроков исполнения мероприятий по {topic}",
]


CLOSURE_INFORMATION_COMMENTS = (
    "Исполнение подтверждено актами подразделения и служебной запиской владельца процесса. "
    "Подтверждающие документы приложены в карточке рекомендации.",
    "Мероприятие выполнено: актуализирован регламент, проведены сверки, результаты направлены аудитору. "
    "Контрольные процедуры внедрены в текущую работу подразделения.",
    "Получены подтверждающие материалы от владельца процесса. "
    "Повторная выборка не выявила повторения замечания, исполнение принято.",
    "Работы завершены в согласованном объёме. Обновлены инструкции, назначены ответственные, "
    "мониторинг показателей поставлен на регулярный контроль.",
    "Представлены скриншоты доработок ИТ-системы и протокол приёмки. "
    "Рекомендация исполнена, качество внедрения подтверждено владельцем процесса.",
)

CONTROL_REMOVAL_COMMENTS = (
    "Рекомендация снята с контроля после проверки исполнения и согласования с руководителем объекта аудита.",
    "Контроль снят: повторная проверка подтвердила устранение замечания и устойчивость внедрённых контролей.",
    "Снято с контроля на основании представленных доказательств и актуализированного регламента.",
    "По итогам мониторинга замечание не воспроизводится. Решение о снятии с контроля согласовано.",
    "Контроль прекращён после подтверждения исполнения и включения мероприятия в регулярную отчётность подразделения.",
)

DEADLINE_EXTENSION_COMMENTS = (
    "Срок перенесён в связи с доработкой ИТ-системы и необходимостью повторного тестирования контролей.",
    "Перенос согласован: подразделение запросило дополнительное время на актуализацию нормативных документов.",
    "Срок продлён из-за изменения организационной структуры и передачи функции новому владельцу процесса.",
    "Перенос срока связан с расширением периметра доработки и дополнительным согласованием со смежными подразделениями.",
    "Дата исполнения сдвинута: требуется повторная сверка данных и обучение сотрудников новым процедурам.",
)

IN_PROGRESS_CLOSURE_COMMENTS = (
    "Исполнение в работе: подготовлен проект регламента, ожидается согласование с юридическим подразделением.",
    "Часть мероприятий выполнена. Остаётся внедрение автоматического контроля и подтверждение на выборке.",
    "Подразделение представило промежуточный отчёт. Срок исполнения сопровождается еженедельным статусом.",
)

UNRESOLVED_CLOSURE_COMMENTS = (
    "Исполнение не завершено: не представлены подтверждающие документы в полном объёме.",
    "Мероприятие сорвано по сроку. Подразделение запросило повторный перенос, решение пока не согласовано.",
    "Замечание сохраняется. Повторная проверка показала, что контрольная процедура внедрена частично.",
)


def _add_days(base: date, days: int) -> date:
    return base + timedelta(days=days)


def _iso_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _pick(items: tuple[str, ...], rng: random.Random) -> str:
    return items[rng.randrange(len(items))]


def build_recommendation_closure_fields(
    *,
    status: str,
    created: date,
    deadline: date,
    index: int,
    rng: random.Random | None = None,
) -> dict:
    """Даты и комментарии для «Срок исполнения», «Перенос срока» и «Снять с контроля»."""
    rng = rng or random.Random(10_000 + index)

    if status == "completed":
        extension_count = 2 if rng.random() < 0.11 else 1 if rng.random() < 0.36 else 0
        fill_completion = True
        fill_removal = True
        closure_pool = CLOSURE_INFORMATION_COMMENTS
    elif status == "on_control":
        extension_count = 2 if rng.random() < 0.09 else 1 if rng.random() < 0.31 else 0
        fill_completion = rng.random() < 0.55
        fill_removal = rng.random() < 0.45
        closure_pool = CLOSURE_INFORMATION_COMMENTS if fill_completion else IN_PROGRESS_CLOSURE_COMMENTS
    elif status == "unresolved":
        extension_count = 2 if rng.random() < 0.18 else 1 if rng.random() < 0.45 else 0
        fill_completion = False
        fill_removal = rng.random() < 0.12
        closure_pool = UNRESOLVED_CLOSURE_COMMENTS
    else:
        extension_count = 2 if rng.random() < 0.1 else 1 if rng.random() < 0.39 else 0
        fill_completion = rng.random() < 0.35
        fill_removal = rng.random() < 0.12
        closure_pool = IN_PROGRESS_CLOSURE_COMMENTS if not fill_completion else CLOSURE_INFORMATION_COMMENTS

    extension_1_date = _add_days(deadline, rng.randint(14, 40)) if extension_count >= 1 else None
    extension_2_date = (
        _add_days(extension_1_date, rng.randint(14, 35)) if extension_count >= 2 and extension_1_date else None
    )
    extension_1_comment = _pick(DEADLINE_EXTENSION_COMMENTS, rng) if extension_1_date else None
    extension_2_comment = _pick(DEADLINE_EXTENSION_COMMENTS, rng) if extension_2_date else None

    effective_deadline = extension_2_date or extension_1_date or deadline
    if fill_completion:
        actual_completion_date = _add_days(effective_deadline, rng.randint(-12, 18))
        if actual_completion_date < created:
            actual_completion_date = _add_days(created, rng.randint(10, 25))
        closure_information = _pick(closure_pool, rng)
    else:
        actual_completion_date = None
        closure_information = _pick(closure_pool, rng) if rng.random() < 0.82 else None

    if fill_removal:
        base_removal = actual_completion_date or effective_deadline
        remove_from_control_date = _add_days(base_removal, rng.randint(3, 21))
        remove_from_control_comment = _pick(CONTROL_REMOVAL_COMMENTS, rng)
    else:
        remove_from_control_date = None
        remove_from_control_comment = None

    deadline_extensions = [
        item
        for item in (
            {"date": _iso_date(extension_1_date), "comment": extension_1_comment}
            if extension_1_date or extension_1_comment
            else None,
            {"date": _iso_date(extension_2_date), "comment": extension_2_comment}
            if extension_2_date or extension_2_comment
            else None,
        )
        if item
    ]
    control_removals = (
        [{"date": _iso_date(remove_from_control_date), "comment": remove_from_control_comment}]
        if remove_from_control_date or remove_from_control_comment
        else []
    )

    return {
        "actual_completion_date": actual_completion_date,
        "closure_information": closure_information,
        "extension_1_reason": None,
        "extension_1_date": extension_1_date,
        "extension_1_comment": extension_1_comment,
        "extension_2_reason": _iso_date(extension_2_date),
        "extension_2_comment": extension_2_comment,
        "remove_from_control_reason": None,
        "remove_from_control_date": remove_from_control_date,
        "remove_from_control_comment": remove_from_control_comment,
        "deadline_extensions": deadline_extensions,
        "control_removals": control_removals,
    }


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
                "check_quarter": (start.month - 1) // 3 + 1,
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
        observation_template = OBSERVATION_NAME_TEMPLATES[index % len(OBSERVATION_NAME_TEMPLATES)]
        n = index + 1
        created = _add_days(check["start_date"], 3)
        deadline = _add_days(created, 45 + (index % 30))
        name = f"{name_template.format(topic=topic)} №{n}"
        observation_name = observation_template.format(topic=topic)
        rows.append(
            {
                "serial_number": serial,
                "sequence_number": sequence_by_serial[serial],
                "name": name,
                "observation_name": observation_name,
                "description": f"{name}. Наблюдение: {observation_name}.",
                "indicator": STATUS_TO_INDICATOR[status],
                "additional_indicator": ADDITIONAL_STATUS_TO_INDICATOR[additional],
                "materiality_level": MATERIALITY_LEVELS[index % len(MATERIALITY_LEVELS)],
                "audit_object": AUDIT_OBJECTS[index % len(AUDIT_OBJECTS)],
                "deadline": deadline,
                "auditor": check["check_leader"],
                "manager": MANAGERS[index % len(MANAGERS)],
                "status": status,
                "additional_status": additional,
                "created_at": created,
                **build_recommendation_closure_fields(
                    status=status,
                    created=created,
                    deadline=deadline,
                    index=n,
                ),
            }
        )
    return rows
