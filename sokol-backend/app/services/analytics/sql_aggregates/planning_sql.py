"""SQL loaders for planning analytics."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.models.recommendations import Recommendation, RecommendationStatus
from app.services.analytics.sql_filters import apply_check_filters, apply_recommendation_filters
from app.services.analytics.sql_helpers import fetch_all

async def load_effectiveness_matrix_rows(session: AsyncSession, **filters: Any) -> list[Check]:
    statement = apply_check_filters(
        select(Check).order_by(Check.serial_number.asc()),
        **filters,
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


async def load_check_department_pairs(
    session: AsyncSession,
    **filters: Any,
) -> list[tuple[int, list[str]]]:
    check_ids_subquery = apply_check_filters(select(Check.id), **filters).subquery()
    statement = select(check_ids_subquery.c.id.label("check_id"), Recommendation.audit_object).select_from(
        check_ids_subquery.outerjoin(
            Recommendation,
            Recommendation.check_id == check_ids_subquery.c.id,
        ),
    )
    rows = await fetch_all(session, statement)
    return [(int(row.check_id), list(row.audit_object or [])) for row in rows if row.check_id is not None]


def _recommendation_status_value(value: Any) -> str:
    if isinstance(value, RecommendationStatus):
        return value.value
    raw = getattr(value, "value", value)
    return str(raw or "").strip()


async def load_planning_recommendation_rows(
    session: AsyncSession,
    **filters: Any,
) -> list[tuple[str, list[str], str, str, str]]:
    """Recommendations of period-filtered checks: serial, audit_object, materiality, status, short_name."""
    checks_subquery = apply_check_filters(
        select(
            Check.id,
            Check.serial_number,
            Check.short_name,
            Check.check_name,
        ),
        years=filters.get("years"),
        quarters=filters.get("quarters"),
        months=filters.get("months"),
        auditors=filters.get("auditors"),
        departments=filters.get("departments"),
    ).subquery()
    statement = select(
        checks_subquery.c.serial_number,
        Recommendation.audit_object,
        Recommendation.materiality_level,
        Recommendation.status,
        checks_subquery.c.short_name,
        checks_subquery.c.check_name,
    ).select_from(
        checks_subquery.join(
            Recommendation,
            Recommendation.check_id == checks_subquery.c.id,
        )
    )
    rows = await fetch_all(session, statement)
    result: list[tuple[str, list[str], str, str, str]] = []
    for row in rows:
        short_name = str(row.short_name or "").strip() or str(row.check_name or "").strip()
        result.append(
            (
                str(row.serial_number or "").strip(),
                list(row.audit_object or []),
                str(row.materiality_level or ""),
                _recommendation_status_value(row.status),
                short_name,
            )
        )
    return result


async def load_recommendation_department_rows(
    session: AsyncSession,
    **filters: Any,
) -> list[tuple[str, list[str], str]]:
    """Return (serial_number, audit_object, materiality_level) for filtered recommendations."""
    statement = apply_recommendation_filters(
        select(
            Recommendation.serial_number,
            Recommendation.audit_object,
            Recommendation.materiality_level,
        ),
        **filters,
    )
    rows = await fetch_all(session, statement)
    return [
        (str(row.serial_number or "").strip(), list(row.audit_object or []), str(row.materiality_level))
        for row in rows
    ]


async def load_check_serial_numbers(session: AsyncSession, **filters: Any) -> list[str]:
    statement = apply_check_filters(select(Check.serial_number), **filters)
    rows = await fetch_all(session, statement)
    return [str(row.serial_number).strip() for row in rows if row.serial_number]
