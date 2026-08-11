"""Unit tests for checks analytics period helpers and aggregations."""

from datetime import date

from app.services.analytics.period import (
    get_period_bucket,
    is_date_in_any_selected_periods,
)


def test_get_period_bucket_month_quarter_year():
    value = date(2025, 3, 15)
    month = get_period_bucket(value, "month")
    assert month.key == "2025-03"
    assert month.label == "01.03.2025"

    quarter = get_period_bucket(value, "quarter")
    assert quarter.key == "2025-Q1"
    assert "(Q1)" in quarter.label

    year = get_period_bucket(value, "year")
    assert year.key == "2025"
    assert year.label == "01.01.2025"


def test_is_date_in_any_selected_periods_or_logic():
    value = date(2025, 8, 1)
    assert is_date_in_any_selected_periods(value, years=[], quarters=[], months=[])
    assert is_date_in_any_selected_periods(value, years=["2025"], quarters=[], months=[])
    assert not is_date_in_any_selected_periods(value, years=["2024"], quarters=[], months=[])
    assert is_date_in_any_selected_periods(
        value,
        years=["2024"],
        quarters=[],
        months=["2025-08"],
    )
