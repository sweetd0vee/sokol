from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

PeriodGranularity = Literal["year", "quarter", "month"]


@dataclass(frozen=True)
class PeriodBucket:
    key: str
    label: str
    sort_key: int


def _pad2(value: int) -> str:
    return f"{value:02d}"


def format_period_first_day(year: int, month_index: int) -> str:
    """First calendar day of the period, e.g. 01.03.2025."""
    return f"01.{_pad2(month_index + 1)}.{year}"


def get_period_bucket(value: date, granularity: PeriodGranularity) -> PeriodBucket:
    year = value.year
    month = value.month - 1

    if granularity == "year":
        return PeriodBucket(
            key=str(year),
            label=str(year),
            sort_key=year,
        )

    if granularity == "quarter":
        quarter = month // 3 + 1
        quarter_start_month = (quarter - 1) * 3
        return PeriodBucket(
            key=f"{year}-Q{quarter}",
            label=f"{format_period_first_day(year, quarter_start_month)} (Q{quarter})",
            sort_key=year * 10 + quarter,
        )

    return PeriodBucket(
        key=f"{year}-{_pad2(month + 1)}",
        label=format_period_first_day(year, month),
        sort_key=year * 100 + month + 1,
    )


def is_date_in_selected_periods(
    value: date,
    granularity: PeriodGranularity,
    selected_period_keys: list[str],
) -> bool:
    if not selected_period_keys:
        return True
    return get_period_bucket(value, granularity).key in selected_period_keys


def is_date_in_any_selected_periods(
    value: date,
    *,
    years: list[str],
    quarters: list[str],
    months: list[str],
) -> bool:
    matches: list[bool] = []
    if years:
        matches.append(is_date_in_selected_periods(value, "year", years))
    if quarters:
        matches.append(is_date_in_selected_periods(value, "quarter", quarters))
    if months:
        matches.append(is_date_in_selected_periods(value, "month", months))
    if not matches:
        return True
    return any(matches)
