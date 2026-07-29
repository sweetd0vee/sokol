#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генерация Excel-файлов с синтетическими проверками и рекомендациями для загрузки в PostgreSQL."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from openpyxl import Workbook

from app.utils.check_key import assign_serial_numbers

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"

CHECK_ROWS = [
    {
        "check_name": "Комплексный аудит клиентских процессов",
        "check_type": "planned",
        "check_view": "бизнес",
        "start_date": date(2025, 12, 1),
        "end_date": None,
        "check_leader": "Иванов А.А.",
        "status": "in_progress",
        "created_at": date(2025, 11, 10),
        "description": "Проверка соблюдения регламентов и сроков обработки.",
    },
    {
        "check_name": "Проверка соответствия регуляторным требованиям",
        "check_type": "unscheduled",
        "check_view": "риски",
        "start_date": date(2025, 12, 12),
        "check_leader": "Петрова И.В.",
        "status": "not_started",
        "created_at": date(2025, 11, 28),
        "description": "Внеплановая проверка по запросу регулятора.",
    },
    {
        "check_name": "Контрольная: контроль качества данных",
        "check_type": "thematic",
        "check_view": "ИТ",
        "start_date": date(2026, 1, 5),
        "check_leader": "Смирнов К.П.",
        "status": "completed",
        "created_at": date(2025, 12, 20),
        "description": "Проверка качества данных в аналитических витринах.",
    },
    {
        "check_name": "Аудит процессов обработки обращений",
        "check_type": "planned",
        "check_view": "корпоуправление",
        "start_date": date(2026, 1, 12),
        "check_leader": "Кузнецова Е.Н.",
        "status": "in_progress",
        "created_at": date(2025, 12, 25),
        "description": "Проверка соблюдения SLA и сроков.",
    },
    {
        "check_name": "Контрольная корректности отчётности",
        "check_type": "thematic",
        "check_view": "иные",
        "start_date": date(2026, 1, 20),
        "check_leader": "Алексеев Д.С.",
        "status": "not_started",
        "created_at": date(2026, 1, 3),
        "description": "Сверка показателей отчётов и источников.",
    },
    {
        "check_name": "Проверка соблюдения регламентов хранения",
        "check_type": "planned",
        "check_view": "ИТ",
        "start_date": date(2026, 1, 28),
        "check_leader": "Громова Т.В.",
        "status": "completed",
        "created_at": date(2026, 1, 7),
        "description": "Оценка соответствия внутренним регламентам.",
    },
    {
        "check_name": "Внеплановый аудит клиентских рисков",
        "check_type": "unscheduled",
        "check_view": "риски",
        "start_date": date(2026, 2, 3),
        "check_leader": "Сорокин М.А.",
        "status": "in_progress",
        "created_at": date(2026, 1, 18),
        "description": "Проверка по обращению службы рисков.",
    },
    {
        "check_name": "Контрольная полноты данных в витринах",
        "check_type": "thematic",
        "check_view": "ИТ",
        "start_date": date(2026, 2, 10),
        "check_leader": "Белова О.И.",
        "status": "not_started",
        "created_at": date(2026, 1, 25),
        "description": "Сопоставление факта и плановых объёмов.",
    },
    {
        "check_name": "Аудит операций по обслуживанию клиентов",
        "check_type": "planned",
        "check_view": "бизнес",
        "start_date": date(2026, 2, 14),
        "check_leader": "Захаров П.П.",
        "status": "completed",
        "created_at": date(2026, 1, 30),
        "description": "Оценка корректности операций и сроков.",
    },
    {
        "check_name": "Контрольная выполнения рекомендаций",
        "check_type": "thematic",
        "check_view": "корпоуправление",
        "start_date": date(2026, 2, 18),
        "check_leader": "Николаева Л.С.",
        "status": "in_progress",
        "created_at": date(2026, 2, 2),
        "description": "Проверка исполнения ранее выданных рекомендаций.",
    },
    {
        "check_name": "Внеплановая проверка качества сервиса",
        "check_type": "unscheduled",
        "check_view": "бизнес",
        "start_date": date(2026, 2, 21),
        "check_leader": "Фёдоров И.А.",
        "status": "not_started",
        "created_at": date(2026, 2, 5),
        "description": "Сигналы ухудшения качества обслуживания.",
    },
    {
        "check_name": "Аудит корректности маршрутизации обращений",
        "check_type": "planned",
        "check_view": "бизнес",
        "start_date": date(2026, 2, 25),
        "check_leader": "Ершова Н.П.",
        "status": "completed",
        "created_at": date(2026, 2, 8),
        "description": "Проверка распределения обращений по очередям.",
    },
    {
        "check_name": "Контрольная соблюдения процедур комплаенса",
        "check_type": "thematic",
        "check_view": "риски",
        "start_date": date(2026, 3, 1),
        "check_leader": "Морозов С.Г.",
        "status": "in_progress",
        "created_at": date(2026, 2, 12),
        "description": "Контроль соответствия внутренним политикам.",
    },
    {
        "check_name": "Внеплановый аудит процессов KYC",
        "check_type": "unscheduled",
        "check_view": "риски",
        "start_date": date(2026, 3, 5),
        "check_leader": "Орлова В.А.",
        "status": "not_started",
        "created_at": date(2026, 2, 16),
        "description": "Оценка полноты данных клиентов.",
    },
    {
        "check_name": "Аудит автоматизированных проверок",
        "check_type": "planned",
        "check_view": "ИТ",
        "start_date": date(2026, 3, 9),
        "check_leader": "Соловьёв П.Н.",
        "status": "completed",
        "created_at": date(2026, 2, 20),
        "description": "Проверка корректности сценариев автоматизации.",
    },
    {
        "check_name": "Контрольная доступности сервисов",
        "check_type": "thematic",
        "check_view": "ИТ",
        "start_date": date(2026, 3, 12),
        "check_leader": "Демидова И.Р.",
        "status": "in_progress",
        "created_at": date(2026, 2, 24),
        "description": "Оценка непрерывности ключевых сервисов.",
    },
    {
        "check_name": "Внеплановый аудит филиальной сети",
        "check_type": "unscheduled",
        "check_view": "корпоуправление",
        "start_date": date(2026, 3, 16),
        "check_leader": "Пономарёв А.Д.",
        "status": "not_started",
        "created_at": date(2026, 2, 28),
        "description": "Проверка соблюдения процедур на местах.",
    },
    {
        "check_name": "Контрольная корректности данных клиентов",
        "check_type": "thematic",
        "check_view": "риски",
        "start_date": date(2026, 3, 20),
        "check_leader": "Тимофеева Е.А.",
        "status": "completed",
        "created_at": date(2026, 3, 3),
        "description": "Выборочная проверка атрибутов клиента.",
    },
    {
        "check_name": "Аудит процессов выдачи кредитов",
        "check_type": "planned",
        "check_view": "бизнес",
        "start_date": date(2026, 3, 24),
        "check_leader": "Лебедев В.Н.",
        "status": "in_progress",
        "created_at": date(2026, 3, 6),
        "description": "Контроль соблюдения регламентов кредитования.",
    },
]

RECOMMENDATION_ROWS = [
    {
        "check_leader": "Иванов А.А.",
        "name": "Внедрить контроль сроков обработки клиентских заявок",
        "audit_object": "Департамент розничного бизнеса",
        "deadline": date(2026, 3, 31),
        "auditor": "Иванов А.А.",
        "manager": "Голец О.В.",
        "status": "in_progress",
        "additional_status": "on_control",
        "materiality_level": "высокий",
        "indicator": "в процессе",
        "created_at": date(2025, 12, 15),
    },
    {
        "check_leader": "Иванов А.А.",
        "name": "Актуализировать матрицу рисков по клиентским процессам",
        "audit_object": "Департамент розничного бизнеса",
        "deadline": date(2026, 4, 15),
        "auditor": "Иванов А.А.",
        "manager": "Голец О.В.",
        "status": "on_control",
        "additional_status": "on_control",
        "materiality_level": "средний",
        "indicator": "ожидает",
        "created_at": date(2025, 12, 15),
    },
    {
        "check_leader": "Петрова И.В.",
        "name": "Устранить несоответствия в отчётности для регулятора",
        "audit_object": "Департамент комплаенса",
        "deadline": date(2026, 1, 31),
        "auditor": "Петрова И.В.",
        "manager": "Кузнецов А.С.",
        "status": "in_progress",
        "additional_status": "deadline_violated",
        "materiality_level": "высокий",
        "indicator": "в процессе",
        "created_at": date(2025, 12, 20),
    },
    {
        "check_leader": "Смирнов К.П.",
        "name": "Настроить автоматический контроль качества данных в витринах",
        "audit_object": "Департамент ИТ",
        "deadline": date(2026, 2, 28),
        "auditor": "Смирнов К.П.",
        "manager": "Сидоров В.И.",
        "status": "completed",
        "additional_status": "on_time",
        "materiality_level": "низкий",
        "indicator": "исполнено",
        "created_at": date(2026, 1, 10),
    },
    {
        "check_leader": "Кузнецова Е.Н.",
        "name": "Сократить время обработки обращений клиентов",
        "audit_object": "Служба клиентского сервиса",
        "deadline": date(2026, 3, 15),
        "auditor": "Кузнецова Е.Н.",
        "manager": "Морозова Е.П.",
        "status": "in_progress",
        "additional_status": "deadline_violated",
        "materiality_level": "средний",
        "indicator": "ожидает",
        "created_at": date(2026, 1, 15),
    },
    {
        "check_leader": "Алексеев Д.С.",
        "name": "Сверить показатели отчётности с первичными источниками",
        "audit_object": "Финансовый департамент",
        "deadline": date(2026, 2, 10),
        "auditor": "Алексеев Д.С.",
        "manager": "Федорова Н.К.",
        "status": "unresolved",
        "additional_status": "deadline_violated",
        "materiality_level": "высокий",
        "indicator": "не решено",
        "created_at": date(2026, 1, 22),
    },
    {
        "check_leader": "Громова Т.В.",
        "name": "Обновить регламент хранения документов",
        "audit_object": "Архивный отдел",
        "deadline": date(2026, 2, 20),
        "auditor": "Громова Т.В.",
        "manager": "Голец О.В.",
        "status": "completed",
        "additional_status": "on_time",
        "materiality_level": "низкий",
        "indicator": "исполнено",
        "created_at": date(2026, 2, 1),
    },
    {
        "check_leader": "Сорокин М.А.",
        "name": "Усилить мониторинг клиентских рисков по сигналам службы рисков",
        "audit_object": "Департамент рисков",
        "deadline": date(2026, 4, 1),
        "auditor": "Сорокин М.А.",
        "manager": "Кузнецов А.С.",
        "status": "in_progress",
        "additional_status": "deadline_violated",
        "materiality_level": "высокий",
        "indicator": "в процессе",
        "created_at": date(2026, 2, 5),
    },
    {
        "check_leader": "Белова О.И.",
        "name": "Провести сверку полноты данных в аналитических витринах",
        "audit_object": "Департамент ИТ",
        "deadline": date(2026, 3, 20),
        "auditor": "Белова О.И.",
        "manager": "Сидоров В.И.",
        "status": "unresolved",
        "additional_status": "deadline_violated",
        "materiality_level": "средний",
        "indicator": "в процессе",
        "created_at": date(2026, 2, 12),
    },
    {
        "check_leader": "Захаров П.П.",
        "name": "Стандартизировать процедуры обслуживания клиентов",
        "audit_object": "Департамент розничного бизнеса",
        "deadline": date(2026, 3, 25),
        "auditor": "Захаров П.П.",
        "manager": "Морозова Е.П.",
        "status": "completed",
        "additional_status": "on_time",
        "materiality_level": "низкий",
        "indicator": "исполнено",
        "created_at": date(2026, 2, 16),
    },
    {
        "check_leader": "Николаева Л.С.",
        "name": "Проверить исполнение ранее выданных рекомендаций",
        "audit_object": "Департамент внутреннего аудита",
        "deadline": date(2026, 4, 10),
        "auditor": "Николаева Л.С.",
        "manager": "Федорова Н.К.",
        "status": "in_progress",
        "additional_status": "on_control",
        "materiality_level": "средний",
        "indicator": "ожидает",
        "created_at": date(2026, 2, 20),
    },
    {
        "check_leader": "Фёдоров И.А.",
        "name": "Разработать план улучшения качества сервиса",
        "audit_object": "Служба клиентского сервиса",
        "deadline": date(2026, 3, 30),
        "auditor": "Фёдоров И.А.",
        "manager": "Голец О.В.",
        "status": "on_control",
        "additional_status": "on_control",
        "materiality_level": "средний",
        "indicator": "ожидает",
        "created_at": date(2026, 2, 22),
    },
    {
        "check_leader": "Ершова Н.П.",
        "name": "Оптимизировать маршрутизацию обращений между очередями",
        "audit_object": "Контакт-центр",
        "deadline": date(2026, 4, 5),
        "auditor": "Ершова Н.П.",
        "manager": "Морозова Е.П.",
        "status": "in_progress",
        "additional_status": "on_control",
        "materiality_level": "низкий",
        "indicator": "в процессе",
        "created_at": date(2026, 2, 28),
    },
    {
        "check_leader": "Морозов С.Г.",
        "name": "Актуализировать процедуры комплаенса",
        "audit_object": "Департамент комплаенса",
        "deadline": date(2026, 4, 20),
        "auditor": "Морозов С.Г.",
        "manager": "Кузнецов А.С.",
        "status": "in_progress",
        "additional_status": "deadline_violated",
        "materiality_level": "высокий",
        "indicator": "не решено",
        "created_at": date(2026, 3, 2),
    },
    {
        "check_leader": "Орлова В.А.",
        "name": "Усилить контроль полноты данных KYC",
        "audit_object": "Департамент рисков",
        "deadline": date(2026, 5, 1),
        "auditor": "Орлова В.А.",
        "manager": "Федорова Н.К.",
        "status": "unresolved",
        "additional_status": "deadline_violated",
        "materiality_level": "высокий",
        "indicator": "ожидает",
        "created_at": date(2026, 3, 6),
    },
    {
        "check_leader": "Соловьёв П.Н.",
        "name": "Проверить корректность сценариев автоматизированных проверок",
        "audit_object": "Департамент ИТ",
        "deadline": date(2026, 4, 15),
        "auditor": "Соловьёв П.Н.",
        "manager": "Сидоров В.И.",
        "status": "completed",
        "additional_status": "on_time",
        "materiality_level": "низкий",
        "indicator": "исполнено",
        "created_at": date(2026, 3, 10),
    },
    {
        "check_leader": "Демидова И.Р.",
        "name": "Оценить непрерывность ключевых ИТ-сервисов",
        "audit_object": "Департамент ИТ",
        "deadline": date(2026, 4, 25),
        "auditor": "Демидова И.Р.",
        "manager": "Сидоров В.И.",
        "status": "in_progress",
        "additional_status": "on_control",
        "materiality_level": "средний",
        "indicator": "в процессе",
        "created_at": date(2026, 3, 14),
    },
    {
        "check_leader": "Пономарёв А.Д.",
        "name": "Проверить соблюдение процедур в филиальной сети",
        "audit_object": "Сеть филиалов",
        "deadline": date(2026, 5, 10),
        "auditor": "Пономарёв А.Д.",
        "manager": "Голец О.В.",
        "status": "in_progress",
        "additional_status": "on_time",
        "materiality_level": "высокий",
        "indicator": "ожидает",
        "created_at": date(2026, 3, 18),
    },
    {
        "check_leader": "Тимофеева Е.А.",
        "name": "Выборочно проверить атрибуты клиентских данных",
        "audit_object": "Департамент рисков",
        "deadline": date(2026, 3, 28),
        "auditor": "Тимофеева Е.А.",
        "manager": "Кузнецов А.С.",
        "status": "completed",
        "additional_status": "on_time",
        "materiality_level": "средний",
        "indicator": "исполнено",
        "created_at": date(2026, 3, 22),
    },
    {
        "check_leader": "Лебедев В.Н.",
        "name": "Актуализировать регламенты кредитования",
        "audit_object": "Кредитный департамент",
        "deadline": date(2026, 5, 15),
        "auditor": "Лебедев В.Н.",
        "manager": "Морозова Е.П.",
        "status": "in_progress",
        "additional_status": "on_time",
        "materiality_level": "низкий",
        "indicator": "в процессе",
        "created_at": date(2026, 3, 26),
    },
]

STATUS_TO_INDICATOR = {
    "completed": "исполнено",
    "in_progress": "в процессе",
    "on_control": "ожидает",
    "unresolved": "не решено",
}


def _write_sheet(workbook: Workbook, title: str, headers: list[str], rows: list[dict]) -> None:
    sheet = workbook.create_sheet(title)
    sheet.append(headers)
    for row in rows:
        sheet.append([row.get(header) for header in headers])


def main() -> None:
    checks = assign_serial_numbers(CHECK_ROWS)
    leader_to_key = {check["check_leader"]: check["serial_number"] for check in checks}
    sequence_by_serial: dict[str, int] = {}
    recommendations = []
    for row in RECOMMENDATION_ROWS:
        serial = leader_to_key[row["check_leader"]]
        sequence_by_serial[serial] = sequence_by_serial.get(serial, 0) + 1
        recommendations.append(
            {
                **row,
                "serial_number": serial,
                "sequence_number": sequence_by_serial[serial],
                "description": row["name"],
                "indicator": row.get("indicator")
                or STATUS_TO_INDICATOR.get(row["status"], "в процессе"),
                "materiality_level": row.get("materiality_level", "средний"),
            }
        )

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    checks_book = Workbook()
    checks_book.remove(checks_book.active)
    check_headers = [
        "serial_number",
        "check_name",
        "check_type",
        "check_view",
        "start_date",
        "end_date",
        "check_leader",
        "status",
        "created_at",
        "description",
    ]
    _write_sheet(checks_book, "checks", check_headers, checks)
    checks_path = DATA_DIR / "checks.xlsx"
    checks_book.save(checks_path)

    rec_book = Workbook()
    rec_book.remove(rec_book.active)
    rec_headers = [
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
    ]
    _write_sheet(rec_book, "recommendations", rec_headers, recommendations)
    rec_path = DATA_DIR / "recommendations.xlsx"
    rec_book.save(rec_path)

    print(f"Created {checks_path}")
    print(f"Created {rec_path}")
    print(f"Checks: {len(checks)}, recommendations: {len(recommendations)}")


if __name__ == "__main__":
    main()
