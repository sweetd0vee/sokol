"""Автостатус рекомендаций: одна таблица правил, два входа (payload и ORM-строка).

Приоритет (первый совпавший выигрывает):

1. «Снять с контроля» → не решено + срок нарушен.
2. «Исполнено в ходе аудита» → звезда + в срок.
3. Есть срок исполнения и срок контроля → исполнено + в срок / срок нарушен.
4. Иначе открытая пара от срока контроля vs сегодня (Москва): на контроле / в процессе.

Перенос срока сначала подменяет ``deadline``, затем считается шаг 3 или 4.
Подробно: ``docs/RECOMMENDATION_INDICATORS.md``.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus

MOSCOW_TZ = timezone(timedelta(hours=3))
DateLike = date | datetime | str | None
ClosureRows = Sequence[Mapping[str, Any]] | Sequence[Any] | None

ON_CONTROL_INDICATOR = "на контроле"
IN_PROGRESS_INDICATOR = "в процессе"
COMPLETED_INDICATOR = "исполнено"
UNRESOLVED_INDICATOR = "не решено"
DEADLINE_VIOLATED_INDICATOR = "срок нарушен"
ON_TIME_INDICATOR = "в срок"
COMPLETED_DURING_AUDIT_INDICATOR = "исполнено в ходе аудита"


@dataclass(frozen=True)
class StatusPair:
    """Одна пара статус + доп. статус и их индикаторы."""

    status: RecommendationStatus
    indicator: str
    additional_status: RecommendationAdditionalStatus
    additional_indicator: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "indicator": self.indicator,
            "additional_status": self.additional_status,
            "additional_indicator": self.additional_indicator,
        }


REMOVED_FROM_CONTROL = StatusPair(
    RecommendationStatus.UNRESOLVED,
    UNRESOLVED_INDICATOR,
    RecommendationAdditionalStatus.DEADLINE_VIOLATED,
    DEADLINE_VIOLATED_INDICATOR,
)
COMPLETED_DURING_AUDIT = StatusPair(
    RecommendationStatus.COMPLETED,
    COMPLETED_DURING_AUDIT_INDICATOR,
    RecommendationAdditionalStatus.ON_TIME,
    ON_TIME_INDICATOR,
)
EXECUTED_ON_TIME = StatusPair(
    RecommendationStatus.COMPLETED,
    COMPLETED_INDICATOR,
    RecommendationAdditionalStatus.ON_TIME,
    ON_TIME_INDICATOR,
)
EXECUTED_LATE = StatusPair(
    RecommendationStatus.COMPLETED,
    COMPLETED_INDICATOR,
    RecommendationAdditionalStatus.DEADLINE_VIOLATED,
    DEADLINE_VIOLATED_INDICATOR,
)
OPEN_ON_CONTROL = StatusPair(
    RecommendationStatus.ON_CONTROL,
    ON_CONTROL_INDICATOR,
    RecommendationAdditionalStatus.ON_CONTROL,
    ON_CONTROL_INDICATOR,
)
OPEN_IN_PROGRESS = StatusPair(
    RecommendationStatus.IN_PROGRESS,
    IN_PROGRESS_INDICATOR,
    RecommendationAdditionalStatus.IN_PROGRESS,
    IN_PROGRESS_INDICATOR,
)

OPEN_PHASE_PAIR = {
    "on_control": OPEN_ON_CONTROL,
    "in_progress": OPEN_IN_PROGRESS,
}


@dataclass(frozen=True)
class AutoStatusFacts:
    """Входные факты для правил. ``effective_deadline`` уже с учётом переноса."""

    control_deadline: date | None
    execution_date: date | None
    latest_extension: date | None
    removed_from_control: bool
    current_indicator: str | None

    @property
    def effective_deadline(self) -> date | None:
        return self.latest_extension or self.control_deadline


def today_moscow(now: datetime | None = None) -> date:
    current = now or datetime.now(MOSCOW_TZ)
    if current.tzinfo is None:
        current = current.replace(tzinfo=MOSCOW_TZ)
    return current.astimezone(MOSCOW_TZ).date()


def seconds_until_next_moscow_run(now: datetime | None = None) -> float:
    """Sleep until 00:05 Europe/Moscow so the calendar date has flipped."""
    current = (now or datetime.now(MOSCOW_TZ)).astimezone(MOSCOW_TZ)
    target = current.replace(hour=0, minute=5, second=0, microsecond=0)
    if current >= target:
        target += timedelta(days=1)
    return max(1.0, (target - current).total_seconds())


def status_phase(anchor: date | None, today: date) -> str | None:
    """``on_control`` before the anchor date, ``in_progress`` on/after it."""
    if anchor is None:
        return None
    if today < anchor:
        return "on_control"
    return "in_progress"


def choose_status_pair(
    *,
    control_deadline: date | None,
    execution_date: date | None = None,
    removed_from_control: bool = False,
    current_indicator: str | None = None,
    today: date | None = None,
) -> StatusPair | None:
    """Первое совпавшее правило. ``None`` — нет срока контроля и нечем заполнить."""
    today = today or today_moscow()
    if removed_from_control:
        return REMOVED_FROM_CONTROL
    if str(current_indicator or "").strip().casefold() == COMPLETED_DURING_AUDIT_INDICATOR:
        return COMPLETED_DURING_AUDIT
    if execution_date is not None and control_deadline is not None:
        return EXECUTED_LATE if execution_date > control_deadline else EXECUTED_ON_TIME
    phase = status_phase(control_deadline, today)
    if phase is None:
        return None
    return OPEN_PHASE_PAIR[phase]


def compute_auto_status_fields(
    *,
    control_deadline: date | None,
    execution_date: date | None = None,
    removed_from_control: bool = False,
    current_status: RecommendationStatus | str | None = None,
    current_additional_status: RecommendationAdditionalStatus | str | None = None,
    current_indicator: str | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Поля, которые автоматика имеет право перезаписать. Текущий статус не защищает."""
    del current_status, current_additional_status
    pair = choose_status_pair(
        control_deadline=control_deadline,
        execution_date=execution_date,
        removed_from_control=removed_from_control,
        current_indicator=current_indicator,
        today=today,
    )
    return {} if pair is None else pair.as_dict()


def control_zone_execution_date(
    *,
    actual_completion_date: DateLike = None,
    deadline_extensions: ClosureRows = None,
    extension_1_date: DateLike = None,
    extension_2_reason: DateLike = None,
) -> date | None:
    """Срок исполнения из контрольной зоны: факт, иначе последний перенос."""
    actual = _as_date(actual_completion_date)
    if actual:
        return actual
    return latest_deadline_extension_date(
        deadline_extensions=deadline_extensions,
        extension_1_date=extension_1_date,
        extension_2_reason=extension_2_reason,
    )


def latest_deadline_extension_date(
    *,
    deadline_extensions: ClosureRows = None,
    extension_1_date: DateLike = None,
    extension_2_reason: DateLike = None,
) -> date | None:
    """Последняя дата «перенос срока»."""
    dates = _extension_dates(
        deadline_extensions,
        extension_1_date,
        extension_2_reason,
    )
    return max(dates) if dates else None


def has_control_removal(
    *,
    control_removals: ClosureRows = None,
    remove_from_control_date: DateLike = None,
    remove_from_control_comment: str | None = None,
) -> bool:
    """True, если «снять с контроля» заполнено датой или комментарием."""
    if control_removals:
        for item in control_removals:
            if _closure_row_filled(item):
                return True
    if _as_date(remove_from_control_date):
        return True
    return bool(str(remove_from_control_comment or "").strip())


def collect_auto_status_facts(
    source: Any,
    *,
    existing: Any | None = None,
) -> AutoStatusFacts:
    """Собрать факты из payload-dict (с fallback на existing) или с ORM-строки."""

    def field(key: str) -> Any:
        if isinstance(source, dict):
            return _payload_value(source, key, existing)
        return getattr(source, key, None)

    return AutoStatusFacts(
        control_deadline=_as_date(field("deadline")),
        execution_date=_as_date(field("actual_completion_date")),
        latest_extension=latest_deadline_extension_date(
            deadline_extensions=field("deadline_extensions"),
            extension_1_date=field("extension_1_date"),
            extension_2_reason=field("extension_2_reason"),
        ),
        removed_from_control=has_control_removal(
            control_removals=field("control_removals"),
            remove_from_control_date=field("remove_from_control_date"),
            remove_from_control_comment=field("remove_from_control_comment"),
        ),
        current_indicator=field("indicator"),
    )


def overlay_computed_status_fields(
    data: dict[str, Any],
    *,
    existing: Any | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Подставить автополя в create/update payload. Перенос пишет ``deadline``."""
    facts = collect_auto_status_facts(data, existing=existing)
    if facts.latest_extension is not None:
        data["deadline"] = facts.latest_extension
    data.update(
        compute_auto_status_fields(
            control_deadline=facts.effective_deadline,
            execution_date=facts.execution_date,
            removed_from_control=facts.removed_from_control,
            current_indicator=facts.current_indicator,
            today=today,
        )
    )
    return data


def apply_computed_status_to_recommendation(
    recommendation: Any,
    *,
    today: date | None = None,
) -> bool:
    """Записать автополя на ORM-строку. True, если что-то изменилось."""
    facts = collect_auto_status_facts(recommendation)
    changed = False
    if (
        facts.latest_extension is not None
        and getattr(recommendation, "deadline", None) != facts.latest_extension
    ):
        recommendation.deadline = facts.latest_extension
        changed = True
    updates = compute_auto_status_fields(
        control_deadline=facts.effective_deadline,
        execution_date=facts.execution_date,
        removed_from_control=facts.removed_from_control,
        current_indicator=facts.current_indicator,
        today=today,
    )
    for key, value in updates.items():
        if getattr(recommendation, key) != value:
            setattr(recommendation, key, value)
            changed = True
    return changed


def _extension_dates(
    deadline_extensions: ClosureRows,
    extension_1_date: DateLike,
    extension_2_reason: DateLike,
) -> list[date]:
    dates: list[date] = []
    if deadline_extensions is not None:
        for item in deadline_extensions:
            raw = item.get("date") if isinstance(item, Mapping) else getattr(item, "date", None)
            parsed = _as_date(raw)
            if parsed:
                dates.append(parsed)
    for raw in (extension_1_date, extension_2_reason):
        parsed = _as_date(raw)
        if parsed:
            dates.append(parsed)
    return dates


def _closure_row_filled(item: object) -> bool:
    if isinstance(item, Mapping):
        raw_date = item.get("date")
        raw_comment = item.get("comment")
    else:
        raw_date = getattr(item, "date", None)
        raw_comment = getattr(item, "comment", None)
    if _as_date(raw_date):
        return True
    return bool(str(raw_comment or "").strip())


def _payload_value(data: dict[str, Any], key: str, existing: Any | None) -> Any:
    if key in data:
        return data.get(key)
    return getattr(existing, key, None)


def _as_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        cleaned = value.strip()[:10]
        if not cleaned:
            return None
        try:
            return date.fromisoformat(cleaned)
        except ValueError:
            return None
    return None
