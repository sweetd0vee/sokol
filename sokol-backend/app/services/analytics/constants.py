"""Shared labels, colors, and sentinel names for analytics dashboards."""

from __future__ import annotations

from app.schemas.analytics import EffectivenessTone

WITHOUT_DEPARTMENT = "Без департамента"
WITHOUT_CHECK = "Без проверки"
WITHOUT_OBJECT = "Без объекта"
WITHOUT_LEADER = "Без руководителя"
WITHOUT_AUDITOR = "Без аудитора"
UNSPECIFIED = "Не указан"

ANCHOR_YEARS = (2025, 2026)
CHECK_LINKS_LIMIT = 12
PLANNING_TOP_DEPARTMENTS = 15

MATERIALITY_LEVELS = ("низкий", "средний", "высокий")
DEFAULT_MATERIALITY = "средний"

CHECK_TYPE_PLURAL_LABELS = {
    "planned": "Плановые",
    "unscheduled": "Внеплановые",
    "thematic": "Контрольные",
}

STATUS_LABELS = {
    "completed": "Исполнено",
    "unresolved": "Не решено",
    "on_control": "На контроле",
    "in_progress": "В процессе",
}
ADDITIONAL_STATUS_LABELS = {
    "on_time": "В срок",
    "deadline_violated": "Срок нарушен",
    "on_control": "На контроле",
}
MATERIALITY_LABELS = {
    "низкий": "Низкий",
    "средний": "Средний",
    "высокий": "Высокий",
}
INDICATOR_LABELS = {
    "в процессе": "В процессе",
    "на контроле": "На контроле",
    "не решено": "Не решено",
    "исполнено": "Исполнено",
    "исполнено в ходе аудита": "Исполнено в ходе аудита",
}
INDICATOR_KEY_ALIASES = {
    "ожидает": "на контроле",
    "жёлтый": "на контроле",
    "желтый": "на контроле",
}
STATUS_COLORS = {
    "completed": "#22C55E",
    "unresolved": "#EF4444",
    "on_control": "#64748B",
    "in_progress": "#F59E0B",
}
ADDITIONAL_STATUS_COLORS = {
    "on_time": "#22C55E",
    "deadline_violated": "#EF4444",
    "on_control": "#64748B",
}
MATERIALITY_COLORS = {
    "низкий": "#22C55E",
    "средний": "#F59E0B",
    "высокий": "#EF4444",
}
INDICATOR_COLORS = {
    "в процессе": "#F59E0B",
    "на контроле": "#64748B",
    "не решено": "#EF4444",
    "исполнено": "#22C55E",
    "исполнено в ходе аудита": "#003366",
}

EFFECTIVENESS_TONE_BY_LABEL: dict[str, EffectivenessTone] = {
    "эффективно": "effective",
    "достаточно эффективно": "sufficient",
    "недостаточно эффективно": "insufficient",
    "неэффективно": "ineffective",
    "не эффективно": "ineffective",
}
UNSET_EFFECTIVENESS_LABELS = {"не указано", "не оценивалось"}
