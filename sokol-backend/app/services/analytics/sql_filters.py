"""SQL WHERE builders for analytics filters (pushed to PostgreSQL)."""

from __future__ import annotations

from sqlalchemy import ColumnElement, and_, exists, extract, or_, select
from sqlalchemy.sql import Select

from app.models.checks import Check
from app.models.recommendations import Recommendation


def _strip_values(values: list[str] | None) -> list[str]:
    return [item.strip() for item in (values or []) if item and item.strip()]


def period_or_condition(
    date_column: ColumnElement,
    *,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
) -> ColumnElement | None:
    """Match Python ``is_date_in_any_selected_periods`` (OR across period types)."""
    parts: list[ColumnElement] = []

    year_values = _strip_values(years)
    if year_values:
        parts.append(extract("year", date_column).in_([int(value) for value in year_values]))

    quarter_values = _strip_values(quarters)
    if quarter_values:
        quarter_parts: list[ColumnElement] = []
        for value in quarter_values:
            year_str, quarter_str = value.split("-Q", 1)
            quarter_parts.append(
                and_(
                    extract("year", date_column) == int(year_str),
                    extract("quarter", date_column) == int(quarter_str),
                )
            )
        parts.append(or_(*quarter_parts))

    month_values = _strip_values(months)
    if month_values:
        month_parts: list[ColumnElement] = []
        for value in month_values:
            year_str, month_str = value.split("-", 1)
            month_parts.append(
                and_(
                    extract("year", date_column) == int(year_str),
                    extract("month", date_column) == int(month_str),
                )
            )
        parts.append(or_(*month_parts))

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

    auditor_values = _strip_values(auditors)
    if auditor_values:
        linked_auditor = exists(
            select(Recommendation.id).where(
                Recommendation.check_id == Check.id,
                or_(
                    Recommendation.auditor.in_(auditor_values),
                    Recommendation.manager.in_(auditor_values),
                ),
            )
        )
        conditions.append(or_(Check.check_leader.in_(auditor_values), linked_auditor))

    department_values = _strip_values(departments)
    if department_values:
        linked_department = exists(
            select(Recommendation.id).where(
                Recommendation.check_id == Check.id,
                Recommendation.audit_object.in_(department_values),
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

    auditor_values = _strip_values(auditors)
    if auditor_values:
        conditions.append(Recommendation.auditor.in_(auditor_values))

    department_values = _strip_values(departments)
    if department_values:
        conditions.append(Recommendation.audit_object.in_(department_values))

    status_values = _strip_values(statuses)
    if status_values:
        conditions.append(Recommendation.status.in_(status_values))

    additional_values = _strip_values(additional_statuses)
    if additional_values:
        conditions.append(Recommendation.additional_status.in_(additional_values))

    materiality_values = _strip_values(materiality_levels)
    if materiality_values:
        conditions.append(Recommendation.materiality_level.in_(materiality_values))

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
    conditions = check_filter_conditions(
        auditors=auditors,
        departments=departments,
        years=years,
        quarters=quarters,
        months=months,
    )
    return statement.where(*conditions)


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
    conditions = recommendation_filter_conditions(
        auditors=auditors,
        departments=departments,
        statuses=statuses,
        additional_statuses=additional_statuses,
        materiality_levels=materiality_levels,
        years=years,
        quarters=quarters,
        months=months,
    )
    return statement.where(*conditions)
