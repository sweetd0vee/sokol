"""Date-driven recommendation status and indicator calculation.

Status / indicator follow ``deadline`` (срок контроля from AZ).
Additional status / indicator follow the control-zone execution date:
``actual_completion_date`` (фактическое исполнение) or the latest
``deadline_extensions`` date (перенос срока), falling back to the control
date when that is empty.

Open items switch ``on_control`` ↔ ``in_progress`` as the Moscow calendar day
moves across the anchor date. Terminal statuses (completed / unresolved) and
manual additional statuses (on_time / deadline_violated) are left untouched.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus

MOSCOW_TZ = timezone(timedelta(hours=3))

ON_CONTROL_INDICATOR = "на контроле"
IN_PROGRESS_INDICATOR = "в процессе"

TERMINAL_STATUSES = frozenset(
    {
        RecommendationStatus.COMPLETED,
        RecommendationStatus.UNRESOLVED,
    }
)
MANUAL_ADDITIONAL_STATUSES = frozenset(
    {
        RecommendationAdditionalStatus.ON_TIME,
        RecommendationAdditionalStatus.DEADLINE_VIOLATED,
    }
)

PHASE_STATUS = {
    "on_control": RecommendationStatus.ON_CONTROL,
    "in_progress": RecommendationStatus.IN_PROGRESS,
}
PHASE_ADDITIONAL_STATUS = {
    "on_control": RecommendationAdditionalStatus.ON_CONTROL,
    "in_progress": RecommendationAdditionalStatus.IN_PROGRESS,
}
PHASE_INDICATOR = {
    "on_control": ON_CONTROL_INDICATOR,
    "in_progress": IN_PROGRESS_INDICATOR,
}


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


def compute_auto_status_fields(
    *,
    control_deadline: date | None,
    execution_deadline: date | None = None,
    current_status: RecommendationStatus | str | None = None,
    current_additional_status: RecommendationAdditionalStatus | str | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Return only the fields that automation is allowed to overwrite."""
    today = today or today_moscow()
    status = _coerce_status(current_status)
    additional = _coerce_additional(current_additional_status)
    updates: dict[str, Any] = {}

    phase = status_phase(control_deadline, today)
    if phase is not None and status not in TERMINAL_STATUSES:
        updates["status"] = PHASE_STATUS[phase]
        updates["indicator"] = PHASE_INDICATOR[phase]

    additional_phase = status_phase(execution_deadline or control_deadline, today)
    if additional_phase is not None and additional not in MANUAL_ADDITIONAL_STATUSES:
        updates["additional_status"] = PHASE_ADDITIONAL_STATUS[additional_phase]
        updates["additional_indicator"] = PHASE_INDICATOR[additional_phase]

    return updates


def control_zone_execution_date(
    *,
    actual_completion_date: object = None,
    deadline_extensions: object = None,
    extension_1_date: object = None,
    extension_2_reason: object = None,
) -> date | None:
    """Срок исполнения from control zone: actual completion, else latest postponement."""
    actual = _as_date(actual_completion_date)
    if actual:
        return actual
    dates: list[date] = []
    if isinstance(deadline_extensions, list):
        for item in deadline_extensions:
            raw = item.get("date") if isinstance(item, dict) else None
            parsed = _as_date(raw)
            if parsed:
                dates.append(parsed)
    for raw in (extension_1_date, extension_2_reason):
        parsed = _as_date(raw)
        if parsed:
            dates.append(parsed)
    return max(dates) if dates else None


def _payload_control_zone_execution(data: dict[str, Any], existing: Any | None) -> date | None:
    return control_zone_execution_date(
        actual_completion_date=_payload_value(data, "actual_completion_date", existing),
        deadline_extensions=_payload_value(data, "deadline_extensions", existing),
        extension_1_date=_payload_value(data, "extension_1_date", existing),
        extension_2_reason=_payload_value(data, "extension_2_reason", existing),
    )


def overlay_computed_status_fields(
    data: dict[str, Any],
    *,
    existing: Any | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Merge auto-calculated fields into a create/update payload dict."""
    control = _payload_date(data, "deadline", existing)
    execution = _payload_control_zone_execution(data, existing)
    current_status = data["status"] if "status" in data else getattr(existing, "status", None)
    current_additional = (
        data["additional_status"]
        if "additional_status" in data
        else getattr(existing, "additional_status", None)
    )
    data.update(
        compute_auto_status_fields(
            control_deadline=control,
            execution_deadline=execution,
            current_status=current_status,
            current_additional_status=current_additional,
            today=today,
        )
    )
    return data


def apply_computed_status_to_recommendation(
    recommendation: Any,
    *,
    today: date | None = None,
) -> bool:
    """Write computed fields onto an ORM row. Returns True when anything changed."""
    updates = compute_auto_status_fields(
        control_deadline=getattr(recommendation, "deadline", None),
        execution_deadline=control_zone_execution_date(
            actual_completion_date=getattr(recommendation, "actual_completion_date", None),
            deadline_extensions=getattr(recommendation, "deadline_extensions", None),
            extension_1_date=getattr(recommendation, "extension_1_date", None),
            extension_2_reason=getattr(recommendation, "extension_2_reason", None),
        ),
        current_status=getattr(recommendation, "status", None),
        current_additional_status=getattr(recommendation, "additional_status", None),
        today=today,
    )
    changed = False
    for key, value in updates.items():
        if getattr(recommendation, key) != value:
            setattr(recommendation, key, value)
            changed = True
    return changed


def _coerce_status(value: RecommendationStatus | str | None) -> RecommendationStatus | None:
    if value is None or isinstance(value, RecommendationStatus):
        return value
    try:
        return RecommendationStatus(str(value).strip())
    except ValueError:
        return None


def _coerce_additional(
    value: RecommendationAdditionalStatus | str | None,
) -> RecommendationAdditionalStatus | None:
    if value is None or isinstance(value, RecommendationAdditionalStatus):
        return value
    try:
        return RecommendationAdditionalStatus(str(value).strip())
    except ValueError:
        return None


def _payload_value(data: dict[str, Any], key: str, existing: Any | None) -> Any:
    if key in data:
        return data.get(key)
    return getattr(existing, key, None)


def _payload_date(data: dict[str, Any], key: str, existing: Any | None) -> date | None:
    return _as_date(_payload_value(data, key, existing))


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
