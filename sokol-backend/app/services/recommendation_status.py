"""Date-driven recommendation status and indicator calculation.

Open items follow ``deadline`` (срок контроля) against the current Moscow date:
before the date both indicators are ``on_control``; on/after it both are
``in_progress``. Filling «снять с контроля» locks ``unresolved`` +
``deadline_violated``. A postponement («перенос срока») rewrites ``deadline``
to the latest extension date, then the same rules apply. When the auditor
fills ``actual_completion_date`` (срок исполнения), status becomes completed
and additional status is ``on_time`` or ``deadline_violated`` vs control
deadline. «Исполнено в ходе аудита» stays locked to the star + ``on_time``.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus

MOSCOW_TZ = timezone(timedelta(hours=3))

ON_CONTROL_INDICATOR = "на контроле"
IN_PROGRESS_INDICATOR = "в процессе"
COMPLETED_INDICATOR = "исполнено"
UNRESOLVED_INDICATOR = "не решено"
DEADLINE_VIOLATED_INDICATOR = "срок нарушен"
ON_TIME_INDICATOR = "в срок"
COMPLETED_DURING_AUDIT_INDICATOR = "исполнено в ходе аудита"

PHASE_STATUS = {
    "on_control": RecommendationStatus.ON_CONTROL,
    "in_progress": RecommendationStatus.IN_PROGRESS,
}
PHASE_ADDITIONAL_STATUS = {
    "on_control": RecommendationAdditionalStatus.ON_CONTROL,
    "in_progress": RecommendationAdditionalStatus.IN_PROGRESS,
}
PHASE_STATUS_INDICATOR = {
    "on_control": ON_CONTROL_INDICATOR,
    "in_progress": IN_PROGRESS_INDICATOR,
}
PHASE_ADDITIONAL_INDICATOR = {
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
    execution_date: date | None = None,
    removed_from_control: bool = False,
    current_status: RecommendationStatus | str | None = None,
    current_additional_status: RecommendationAdditionalStatus | str | None = None,
    current_indicator: str | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Return only the fields that automation is allowed to overwrite."""
    today = today or today_moscow()
    updates: dict[str, Any] = {}
    completed_during_audit = (
        str(current_indicator or "").strip().casefold() == COMPLETED_DURING_AUDIT_INDICATOR
    )

    if removed_from_control:
        updates["status"] = RecommendationStatus.UNRESOLVED
        updates["indicator"] = UNRESOLVED_INDICATOR
        updates["additional_status"] = RecommendationAdditionalStatus.DEADLINE_VIOLATED
        updates["additional_indicator"] = DEADLINE_VIOLATED_INDICATOR
        return updates

    if completed_during_audit:
        updates["status"] = RecommendationStatus.COMPLETED
        updates["indicator"] = COMPLETED_DURING_AUDIT_INDICATOR
        updates["additional_status"] = RecommendationAdditionalStatus.ON_TIME
        updates["additional_indicator"] = ON_TIME_INDICATOR
        return updates

    if execution_date is not None and control_deadline is not None:
        late = execution_date > control_deadline
        updates["status"] = RecommendationStatus.COMPLETED
        updates["indicator"] = COMPLETED_INDICATOR
        updates["additional_status"] = (
            RecommendationAdditionalStatus.DEADLINE_VIOLATED
            if late
            else RecommendationAdditionalStatus.ON_TIME
        )
        updates["additional_indicator"] = (
            DEADLINE_VIOLATED_INDICATOR if late else ON_TIME_INDICATOR
        )
        return updates

    phase = status_phase(control_deadline, today)
    if phase is not None:
        updates["status"] = PHASE_STATUS[phase]
        updates["indicator"] = PHASE_STATUS_INDICATOR[phase]
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


def latest_deadline_extension_date(
    *,
    deadline_extensions: Sequence[Mapping[str, Any]] | Sequence[Any] | None = None,
    extension_1_date: DateLike = None,
    extension_2_reason: DateLike = None,
) -> date | None:
    """Latest «перенос срока» date from the control zone."""
    return control_zone_execution_date(
        deadline_extensions=deadline_extensions,
        extension_1_date=extension_1_date,
        extension_2_reason=extension_2_reason,
    )


def has_control_removal(
    *,
    control_removals: Sequence[Mapping[str, Any]] | Sequence[Any] | None = None,
    remove_from_control_date: DateLike = None,
    remove_from_control_comment: str | None = None,
) -> bool:
    """True when «снять с контроля» has a date or comment."""
    if control_removals:
        for item in control_removals:
            if _closure_row_filled(item):
                return True
    if _as_date(remove_from_control_date):
        return True
    return bool(str(remove_from_control_comment or "").strip())


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


def overlay_computed_status_fields(
    data: dict[str, Any],
    *,
    existing: Any | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Merge auto-calculated fields into a create/update payload dict."""
    latest_extension = latest_deadline_extension_date(
        deadline_extensions=_payload_value(data, "deadline_extensions", existing),
        extension_1_date=_payload_value(data, "extension_1_date", existing),
        extension_2_reason=_payload_value(data, "extension_2_reason", existing),
    )
    if latest_extension is not None:
        data["deadline"] = latest_extension
    control = _payload_date(data, "deadline", existing)
    execution = _payload_date(data, "actual_completion_date", existing)
    removed = has_control_removal(
        control_removals=_payload_value(data, "control_removals", existing),
        remove_from_control_date=_payload_value(data, "remove_from_control_date", existing),
        remove_from_control_comment=_payload_value(data, "remove_from_control_comment", existing),
    )
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
            execution_date=execution,
            removed_from_control=removed,
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
    latest_extension = latest_deadline_extension_date(
        deadline_extensions=getattr(recommendation, "deadline_extensions", None),
        extension_1_date=getattr(recommendation, "extension_1_date", None),
        extension_2_reason=getattr(recommendation, "extension_2_reason", None),
    )
    changed = False
    if latest_extension is not None and getattr(recommendation, "deadline", None) != latest_extension:
        recommendation.deadline = latest_extension
        changed = True
    updates = compute_auto_status_fields(
        control_deadline=latest_extension or getattr(recommendation, "deadline", None),
        execution_date=getattr(recommendation, "actual_completion_date", None),
        removed_from_control=has_control_removal(
            control_removals=getattr(recommendation, "control_removals", None),
            remove_from_control_date=getattr(recommendation, "remove_from_control_date", None),
            remove_from_control_comment=getattr(recommendation, "remove_from_control_comment", None),
        ),
        current_status=getattr(recommendation, "status", None),
        current_additional_status=getattr(recommendation, "additional_status", None),
        current_indicator=getattr(recommendation, "indicator", None),
        today=today,
    )
    for key, value in updates.items():
        if getattr(recommendation, key) != value:
            setattr(recommendation, key, value)
            changed = True
    return changed


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
