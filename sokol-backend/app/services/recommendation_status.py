"""Date-driven recommendation status and indicator calculation.

Status / indicator and additional status / indicator both follow ``deadline``
(срок контроля from AZ) against the current Moscow date.

Open items switch ``on_control`` ↔ overdue (``unresolved`` + ``deadline_violated``)
as the Moscow calendar day moves across the control date. Completed status and
manual additional status ``on_time`` are left untouched.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus

MOSCOW_TZ = timezone(timedelta(hours=3))

ON_CONTROL_INDICATOR = "на контроле"
UNRESOLVED_INDICATOR = "не решено"
DEADLINE_VIOLATED_INDICATOR = "срок нарушен"
COMPLETED_DURING_AUDIT_INDICATOR = "исполнено в ходе аудита"

TERMINAL_STATUSES = frozenset({RecommendationStatus.COMPLETED})
MANUAL_ADDITIONAL_STATUSES = frozenset({RecommendationAdditionalStatus.ON_TIME})

PHASE_STATUS = {
    "on_control": RecommendationStatus.ON_CONTROL,
    "overdue": RecommendationStatus.UNRESOLVED,
}
PHASE_ADDITIONAL_STATUS = {
    "on_control": RecommendationAdditionalStatus.ON_CONTROL,
    "overdue": RecommendationAdditionalStatus.DEADLINE_VIOLATED,
}
PHASE_STATUS_INDICATOR = {
    "on_control": ON_CONTROL_INDICATOR,
    "overdue": UNRESOLVED_INDICATOR,
}
PHASE_ADDITIONAL_INDICATOR = {
    "on_control": ON_CONTROL_INDICATOR,
    "overdue": DEADLINE_VIOLATED_INDICATOR,
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
    """``on_control`` before the anchor date, ``overdue`` on/after it."""
    if anchor is None:
        return None
    if today < anchor:
        return "on_control"
    return "overdue"


def compute_auto_status_fields(
    *,
    control_deadline: date | None,
    current_status: RecommendationStatus | str | None = None,
    current_additional_status: RecommendationAdditionalStatus | str | None = None,
    current_indicator: str | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Return only the fields that automation is allowed to overwrite."""
    today = today or today_moscow()
    status = _coerce_status(current_status)
    additional = _coerce_additional(current_additional_status)
    updates: dict[str, Any] = {}
    completed_during_audit = (
        str(current_indicator or "").strip().casefold() == COMPLETED_DURING_AUDIT_INDICATOR
    )

    phase = status_phase(control_deadline, today)
    if (
        phase is not None
        and status not in TERMINAL_STATUSES
        and not completed_during_audit
    ):
        updates["status"] = PHASE_STATUS[phase]
        updates["indicator"] = PHASE_STATUS_INDICATOR[phase]

    if phase is not None and additional not in MANUAL_ADDITIONAL_STATUSES:
        updates["additional_status"] = PHASE_ADDITIONAL_STATUS[phase]
        updates["additional_indicator"] = PHASE_ADDITIONAL_INDICATOR[phase]

    return updates


DateLike = date | datetime | str | None


def control_zone_execution_date(
    *,
    actual_completion_date: DateLike = None,
    deadline_extensions: Sequence[Mapping[str, Any]] | Sequence[Any] | None = None,
    extension_1_date: DateLike = None,
    extension_2_reason: DateLike = None,
) -> date | None:
    """Срок исполнения from control zone: actual completion, else latest postponement."""
    actual = _as_date(actual_completion_date)
    if actual:
        return actual
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
    return max(dates) if dates else None


def overlay_computed_status_fields(
    data: dict[str, Any],
    *,
    existing: Any | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Merge auto-calculated fields into a create/update payload dict."""
    control = _payload_date(data, "deadline", existing)
    current_status = data["status"] if "status" in data else getattr(existing, "status", None)
    current_additional = (
        data["additional_status"]
        if "additional_status" in data
        else getattr(existing, "additional_status", None)
    )
    current_indicator = data["indicator"] if "indicator" in data else getattr(existing, "indicator", None)
    data.update(
        compute_auto_status_fields(
            control_deadline=control,
            current_status=current_status,
            current_additional_status=current_additional,
            current_indicator=current_indicator,
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
        current_status=getattr(recommendation, "status", None),
        current_additional_status=getattr(recommendation, "additional_status", None),
        current_indicator=getattr(recommendation, "indicator", None),
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
