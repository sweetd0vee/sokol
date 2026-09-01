"""Small value helpers shared across analytics modules."""

from __future__ import annotations

from datetime import date

from app.schemas.analytics import NamedCount
from app.services.analytics.constants import ANCHOR_YEARS


def stripped_values(values: list[str] | None) -> list[str]:
    return [item.strip() for item in (values or []) if item and item.strip()]


def stripped_set(values: list[str] | None) -> set[str]:
    return set(stripped_values(values))


def enum_str(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


def named_counts(counts: dict[str, int], *, positive_only: bool = False) -> list[NamedCount]:
    items = counts.items()
    if positive_only:
        items = ((name, value) for name, value in items if value > 0)
    return [
        NamedCount(name=name, value=value)
        for name, value in sorted(items, key=lambda row: (-row[1], row[0]))
    ]


def completion_share(total: int, completed: int) -> int:
    if total <= 0:
        return 0
    return round((completed / total) * 100)


def pad_anchor_dates(dates: list[date]) -> list[str]:
    iso_dates = {value.isoformat() for value in dates if value is not None}
    for year in ANCHOR_YEARS:
        iso_dates.add(date(year, 1, 1).isoformat())
    return sorted(iso_dates)
