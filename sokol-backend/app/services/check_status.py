"""Date-driven check status. Same calendar as recommendation auto-status: Europe/Moscow."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.models.checks import CheckStatus
from app.services.recommendation_status import today_moscow


def choose_check_status(
    *,
    start_date: date | None,
    dz_document_date: date | None,
    today: date | None = None,
) -> CheckStatus:
    """Первое совпавшее правило.

    Проставлена дата ДЗ → завершено.
    Дата начала позже сегодня → запланировано.
    Иначе (начало сегодня или раньше, либо даты начала нет) → в процессе.
    ``end_date`` не участвует.
    """
    current = today or today_moscow()
    if dz_document_date is not None:
        return CheckStatus.COMPLETED
    if start_date is not None and start_date > current:
        return CheckStatus.NOT_STARTED
    return CheckStatus.IN_PROGRESS


def overlay_check_status(
    data: dict[str, Any],
    *,
    existing: Any | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Подставить вычисленный ``status`` в create/update payload. Значение клиента не сохраняется."""
    if "start_date" in data:
        start_date = data.get("start_date")
    else:
        start_date = getattr(existing, "start_date", None) if existing is not None else None
    if "dz_document_date" in data:
        dz_document_date = data.get("dz_document_date")
    else:
        dz_document_date = (
            getattr(existing, "dz_document_date", None) if existing is not None else None
        )
    data["status"] = choose_check_status(
        start_date=start_date,
        dz_document_date=dz_document_date,
        today=today,
    )
    return data


def apply_computed_status_to_check(check: Any, *, today: date | None = None) -> bool:
    """Записать автостатус на ORM-строку. True, если статус изменился."""
    status = choose_check_status(
        start_date=getattr(check, "start_date", None),
        dz_document_date=getattr(check, "dz_document_date", None),
        today=today,
    )
    if getattr(check, "status", None) == status:
        return False
    check.status = status
    return True
