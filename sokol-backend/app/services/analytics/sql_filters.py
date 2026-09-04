"""SQL WHERE builders for analytics filters (pushed to PostgreSQL)."""

from __future__ import annotations

from sqlalchemy import ColumnElement, and_, exists, extract, func, or_, select
from sqlalchemy.sql import Select

from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.services.analytics.values import stripped_values


def _in_if_present(column, values: list[str] | None) -> ColumnElement | None:
    stripped = stripped_values(values)
    if not stripped:
        return None
    return column.in_(stripped)


def _extract_equals(date_column: ColumnElement, field: str, value: int) -> ColumnElement:
    return extract(field, date_column) == value


def _period_key_matches(
    date_column: ColumnElement,
    values: list[str],
    *,
    separator: str,
    other_field: str,
) -> ColumnElement:
    parts: list[ColumnElement] = []
    for value in values:
        year_str, other_str = value.split(separator, 1)
        parts.append(
            and_(
                _extract_equals(date_column, "year", int(year_str)),
                _extract_equals(date_column, other_field, int(other_str)),
            )
        )
    return or_(*parts)


def audit_object_has_values() -> ColumnElement:
    return and_(
        Recommendation.audit_object.isnot(None),
        func.cardinality(Recommendation.audit_object) > 0,
    )


def period_or_condition(
    date_column: ColumnElement,
    *,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> ColumnElement | None:
    """Match Python ``is_date_in_any_selected_periods`` (OR across period types)."""
    parts: list[ColumnElement] = []

    year_values = stripped_values(years)
    if year_values:
        parts.append(extract("year", date_column).in_([int(value) for value in year_values]))

    quarter_values = stripped_values(quarters)
    if quarter_values:
        parts.append(
            _period_key_matches(date_column, quarter_values, separator="-Q", other_field="quarter")
        )

    month_values = stripped_values(months)
    if month_values:
        parts.append(
            _period_key_matches(date_column, month_values, separator="-", other_field="month")
        )

    if not parts:
        return None
    return or_(*parts)


def check_filter_conditions(
    *,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> list[ColumnElement]:
    conditions: list[ColumnElement] = [Check.start_date.isnot(None)]

    period = period_or_condition(
        Check.start_date,
        years=years,
        quarters=quarters,
        months=months,
    )
    if period is not None:
        conditions.append(period)

    auditor_values = stripped_values(auditors)
    if auditor_values:
        linked_auditor = exists(
            select(Recommendation.id).where(
                Recommendation.check_id == Check.id,
                Recommendation.auditor.in_(auditor_values),
            )
        )
        conditions.append(or_(Check.check_leader.in_(auditor_values), linked_auditor))

    department_values = stripped_values(departments)
    if department_values:
        linked_department = exists(
            select(Recommendation.id).where(
                Recommendation.check_id == Check.id,
                Recommendation.audit_object.overlap(department_values),
            )
        )
        conditions.append(linked_department)

    return conditions


def recommendation_filter_conditions(
    *,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    statuses: list[str] | None = None,
    additional_statuses: list[str] | None = None,
    materiality_levels: list[str] | None = None,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> list[ColumnElement]:
    conditions: list[ColumnElement] = [Recommendation.deadline.isnot(None)]

    period = period_or_condition(
        Recommendation.deadline,
        years=years,
        quarters=quarters,
        months=months,
    )
    if period is not None:
        conditions.append(period)

    auditor_condition = _in_if_present(Recommendation.auditor, auditors)
    if auditor_condition is not None:
        conditions.append(auditor_condition)

    department_values = stripped_values(departments)
    if department_values:
        conditions.append(Recommendation.audit_object.overlap(department_values))

    for column, values in (
        (Recommendation.status, statuses),
        (Recommendation.additional_status, additional_statuses),
        (Recommendation.materiality_level, materiality_levels),
    ):
        condition = _in_if_present(column, values)
        if condition is not None:
            conditions.append(condition)

    return conditions


def apply_check_filters(
    statement: Select,
    *,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> Select:
    return statement.where(
        *check_filter_conditions(
            auditors=auditors,
            departments=departments,
            years=years,
            quarters=quarters,
            months=months,
        )
    )


def apply_recommendation_filters(
    statement: Select,
    *,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    statuses: list[str] | None = None,
    additional_statuses: list[str] | None = None,
    materiality_levels: list[str] | None = None,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> Select:
    return statement.where(
        *recommendation_filter_conditions(
            auditors=auditors,
            departments=departments,
            statuses=statuses,
            additional_statuses=additional_statuses,
            materiality_levels=materiality_levels,
            years=years,
            quarters=quarters,
            months=months,
        )
    )
