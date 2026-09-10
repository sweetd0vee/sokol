"""SQL aggregates for the DVA employee analytics dashboard."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.schemas.analytics import (
    AuditorCheckCount,
    DocumentReadinessRow,
    DvaAuditorDocumentRow,
    DvaAuditorExecutionRow,
    DvaAuditorLoadRow,
    DvaAuditorMaterialityRow,
    DvaAuditorMatrix,
    DvaAuditorMatrixCell,
    DvaAuditorMatrixRow,
    DvaAuditorTimelinessRow,
    DvaCheckCountRef,
    DvaCheckLifecycleRow,
    DvaMissingCheckRef,
    DvaPortfolioPoint,
    NamedCount,
    PeriodBucketSchema,
    PeriodGranularity,
)
from app.services.analytics.constants import UNSPECIFIED, WITHOUT_AUDITOR, WITHOUT_CHECK, WITHOUT_LEADER
from app.services.analytics.sql_filters import (
    apply_check_filters,
    apply_recommendation_filters,
    check_filter_conditions,
    recommendation_filter_conditions,
)
from app.services.analytics.sql_helpers import (
    check_group_identity,
    count_if,
    fetch_all,
    fetch_one,
    grouped_named_counts_sql,
    period_from_sql_row,
    period_group_columns,
    recommendation_materiality_count_columns,
    recommendation_status_count_columns,
)

def _ensure_portfolio_point(
    merged: dict[str, DvaPortfolioPoint],
    period,
) -> DvaPortfolioPoint:
    current = merged.get(period.key)
    if current is None:
        current = DvaPortfolioPoint(
            key=period.key,
            label=period.label,
            sort_key=period.sort_key,
            checks=0,
            recommendations=0,
        )
        merged[period.key] = current
    return current


async def dva_portfolio_series_sql(
    session: AsyncSession,
    granularity: PeriodGranularity,
    *,
    check_filters: dict[str, Any],
    recommendation_filters: dict[str, Any],
) -> list[DvaPortfolioPoint]:
    check_group = period_group_columns(Check.start_date, granularity)
    check_statement = apply_check_filters(
        select(*check_group, func.count().label("checks")).select_from(Check).group_by(*check_group),
        **check_filters,
    )
    rec_group = period_group_columns(Recommendation.deadline, granularity)
    rec_statement = apply_recommendation_filters(
        select(*rec_group, func.count().label("recommendations")).select_from(Recommendation).group_by(*rec_group),
        **recommendation_filters,
    )
    merged: dict[str, DvaPortfolioPoint] = {}
    for row in await fetch_all(session, check_statement):
        period = period_from_sql_row(row, granularity)
        _ensure_portfolio_point(merged, period).checks = int(row.checks)
    for row in await fetch_all(session, rec_statement):
        period = period_from_sql_row(row, granularity)
        _ensure_portfolio_point(merged, period).recommendations = int(row.recommendations)
    return sorted(merged.values(), key=lambda row: row.sort_key)


def dva_auditor_checks_treemap_from_rows(rows: Any) -> list[AuditorCheckCount]:
    totals: dict[str, int] = defaultdict(int)
    views: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in rows:
        name = _auditor_display_name(row.name, WITHOUT_LEADER)
        view = str(getattr(row, "check_view", "") or "").strip() or UNSPECIFIED
        totals[name] += 1
        views[name][view] += 1
    return [
        AuditorCheckCount(
            name=name,
            value=value,
            views=[
                NamedCount(name=view_name, value=view_count)
                for view_name, view_count in sorted(
                    views[name].items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ],
        )
        for name, value in sorted(totals.items(), key=lambda item: (-item[1], item[0]))
        if value > 0
    ]


async def dva_auditor_checks_treemap_sql(session: AsyncSession, **filters: Any) -> list[AuditorCheckCount]:
    statement = select(Check.check_leader.label("name"), Check.check_view).where(
        *check_filter_conditions(**filters),
    )
    return dva_auditor_checks_treemap_from_rows(await fetch_all(session, statement))


def dva_auditor_load_from_counts(
    check_rows: list[NamedCount],
    rec_rows: list[NamedCount],
) -> list[DvaAuditorLoadRow]:
    check_counts = {row.name.strip() or WITHOUT_LEADER: row.value for row in check_rows}
    rec_counts = {row.name.strip() or WITHOUT_AUDITOR: row.value for row in rec_rows}
    names = set(check_counts) | set(rec_counts)
    rows = [
        DvaAuditorLoadRow(
            name=name,
            checks=check_counts.get(name, 0),
            recommendations=rec_counts.get(name, 0),
            value=check_counts.get(name, 0) + rec_counts.get(name, 0),
        )
        for name in names
        if check_counts.get(name, 0) > 0 or rec_counts.get(name, 0) > 0
    ]
    return sorted(rows, key=lambda row: (-row.value, row.name))


async def dva_auditor_load_sql(
    session: AsyncSession,
    *,
    check_filters: dict[str, Any],
    recommendation_filters: dict[str, Any],
) -> list[DvaAuditorLoadRow]:
    check_rows = await grouped_named_counts_sql(
        session,
        model=Check,
        column=Check.check_leader,
        filters=check_filter_conditions(**check_filters),
        positive_only=True,
    )
    rec_rows = await grouped_named_counts_sql(
        session,
        model=Recommendation,
        column=Recommendation.auditor,
        filters=recommendation_filter_conditions(**recommendation_filters),
        positive_only=True,
    )
    return dva_auditor_load_from_counts(check_rows, rec_rows)


def _auditor_display_name(raw: Any, fallback: str) -> str:
    value = str(raw or "").strip()
    return value or fallback


def dva_unresolved_checks_from_rows(rows: Any) -> dict[str, list[DvaCheckCountRef]]:
    grouped: dict[str, dict[str, DvaCheckCountRef]] = {}
    for row in rows:
        count = int(row.value or 0)
        if count <= 0:
            continue
        name = _auditor_display_name(row.name, WITHOUT_AUDITOR)
        identity = check_group_identity(row)
        by_check = grouped.setdefault(name, {})
        existing = by_check.get(identity.id)
        if existing is None:
            by_check[identity.id] = DvaCheckCountRef(
                key=identity.key,
                short_name=identity.short_name or identity.name,
                count=count,
            )
            continue
        by_check[identity.id] = DvaCheckCountRef(
            key=existing.key,
            short_name=existing.short_name,
            count=existing.count + count,
        )
    return {
        name: sorted(by_check.values(), key=lambda item: (-item.count, item.key))
        for name, by_check in grouped.items()
    }


def dva_recommendation_profiles_from_rows(
    rows: Any,
    unresolved_checks_by_auditor: dict[str, list[DvaCheckCountRef]] | None = None,
) -> tuple[list[DvaAuditorMaterialityRow], list[DvaAuditorExecutionRow], list[DvaAuditorTimelinessRow]]:
    impact: list[DvaAuditorMaterialityRow] = []
    execution: list[DvaAuditorExecutionRow] = []
    timeliness: list[DvaAuditorTimelinessRow] = []
    checks_map = unresolved_checks_by_auditor or {}
    for row in rows:
        name = _auditor_display_name(row.name, WITHOUT_AUDITOR)
        total = int(row.total)
        if total <= 0:
            continue
        low = int(row.low)
        medium = int(row.medium)
        high = int(row.high)
        completed = int(row.completed)
        in_progress = int(row.in_progress)
        on_control = int(row.on_control)
        unresolved = int(row.unresolved)
        on_time = int(row.on_time)
        deadline_violated = int(row.deadline_violated)
        add_on_control = int(row.add_on_control)
        add_in_progress = int(getattr(row, "add_in_progress", 0) or 0)
        impact.append(
            DvaAuditorMaterialityRow(name=name, low=low, medium=medium, high=high, total=total)
        )
        execution.append(
            DvaAuditorExecutionRow(
                name=name,
                completed=completed,
                in_progress=in_progress,
                on_control=on_control,
                unresolved=unresolved,
                total=total,
                unresolved_checks=checks_map.get(name, []),
            )
        )
        timeliness.append(
            DvaAuditorTimelinessRow(
                name=name,
                on_time=on_time,
                deadline_violated=deadline_violated,
                on_control=add_on_control,
                in_progress=add_in_progress,
                total=total,
                violation_rate=round((deadline_violated / total) * 100) if total else 0,
            )
        )
    impact.sort(key=lambda item: (-item.high, -item.total, item.name))
    execution.sort(key=lambda item: (-item.unresolved, -item.total, item.name))
    timeliness.sort(key=lambda item: (-item.deadline_violated, -item.violation_rate, item.name))
    return impact, execution, timeliness


async def dva_auditor_recommendation_profiles_sql(
    session: AsyncSession,
    **filters: Any,
) -> tuple[list[DvaAuditorMaterialityRow], list[DvaAuditorExecutionRow], list[DvaAuditorTimelinessRow]]:
    statement = apply_recommendation_filters(
        select(
            Recommendation.auditor.label("name"),
            func.count().label("total"),
            *recommendation_status_count_columns(),
            *recommendation_materiality_count_columns(),
            count_if(Recommendation.additional_status == "on_time", "on_time"),
            count_if(Recommendation.additional_status == "deadline_violated", "deadline_violated"),
            count_if(Recommendation.additional_status == "on_control", "add_on_control"),
            count_if(Recommendation.additional_status == "in_progress", "add_in_progress"),
        )
        .select_from(Recommendation)
        .group_by(Recommendation.auditor),
        **filters,
    )
    check_serial = func.coalesce(Check.serial_number, Recommendation.serial_number)
    check_statement = apply_recommendation_filters(
        select(
            Recommendation.auditor.label("name"),
            Check.id.label("check_id"),
            check_serial.label("serial_number"),
            Check.short_name,
            Check.check_name,
            func.count().label("value"),
        )
        .select_from(Recommendation)
        .outerjoin(Check, Check.id == Recommendation.check_id)
        .group_by(
            Recommendation.auditor,
            Check.id,
            check_serial,
            Check.short_name,
            Check.check_name,
        ),
        **filters,
        statuses=["unresolved"],
    )
    return dva_recommendation_profiles_from_rows(
        await fetch_all(session, statement),
        dva_unresolved_checks_from_rows(await fetch_all(session, check_statement)),
    )


def _document_is_filled(number: Any, date_value: Any) -> bool:
    return number is not None or date_value is not None


def _missing_check_ref(row: Any) -> DvaMissingCheckRef:
    serial = str(row.serial_number or "").strip() or WITHOUT_CHECK
    short_name = str(row.short_name or "").strip() or str(row.check_name or "").strip()
    return DvaMissingCheckRef(key=serial, short_name=short_name)


def dva_auditor_documents_from_rows(rows: Any) -> list[DvaAuditorDocumentRow]:
    buckets: dict[str, dict[str, Any]] = {}
    for row in rows:
        name = _auditor_display_name(row.name, WITHOUT_LEADER)
        bucket = buckets.get(name)
        if bucket is None:
            bucket = {
                "checks": 0,
                "order_filled": 0,
                "program_filled": 0,
                "az_filled": 0,
                "dz_filled": 0,
                "missing_order": [],
                "missing_program": [],
                "missing_az": [],
                "missing_dz": [],
            }
            buckets[name] = bucket
        bucket["checks"] += 1
        ref = _missing_check_ref(row)
        if _document_is_filled(row.order_document_number, row.order_document_date):
            bucket["order_filled"] += 1
        else:
            bucket["missing_order"].append(ref)
        if _document_is_filled(row.program_document_number, row.program_document_date):
            bucket["program_filled"] += 1
        else:
            bucket["missing_program"].append(ref)
        if _document_is_filled(row.az_document_number, row.az_document_date):
            bucket["az_filled"] += 1
        else:
            bucket["missing_az"].append(ref)
        if _document_is_filled(row.dz_document_number, row.dz_document_date):
            bucket["dz_filled"] += 1
        else:
            bucket["missing_dz"].append(ref)

    result: list[DvaAuditorDocumentRow] = []
    for name, bucket in buckets.items():
        checks = int(bucket["checks"])
        if checks <= 0:
            continue
        slots = checks * 4
        filled = (
            bucket["order_filled"]
            + bucket["program_filled"]
            + bucket["az_filled"]
            + bucket["dz_filled"]
        )
        result.append(
            DvaAuditorDocumentRow(
                name=name,
                checks=checks,
                order_filled=bucket["order_filled"],
                program_filled=bucket["program_filled"],
                az_filled=bucket["az_filled"],
                dz_filled=bucket["dz_filled"],
                readiness=int(filled / slots * 100 + 0.5) if slots else 0,
                missing_order=sorted(bucket["missing_order"], key=lambda item: item.key),
                missing_program=sorted(bucket["missing_program"], key=lambda item: item.key),
                missing_az=sorted(bucket["missing_az"], key=lambda item: item.key),
                missing_dz=sorted(bucket["missing_dz"], key=lambda item: item.key),
            )
        )
    return sorted(result, key=lambda item: (item.readiness, -item.checks, item.name))


async def dva_auditor_documents_sql(session: AsyncSession, **filters: Any) -> list[DvaAuditorDocumentRow]:
    statement = apply_check_filters(
        select(
            Check.check_leader.label("name"),
            Check.serial_number,
            Check.short_name,
            Check.check_name,
            Check.order_document_number,
            Check.order_document_date,
            Check.program_document_number,
            Check.program_document_date,
            Check.az_document_number,
            Check.az_document_date,
            Check.dz_document_number,
            Check.dz_document_date,
        ).select_from(Check),
        **filters,
    )
    return dva_auditor_documents_from_rows(await fetch_all(session, statement))


def _lifecycle_sort_key(row: DvaCheckLifecycleRow) -> tuple:
    dates = [value for value in (row.order_date, row.program_date, row.az_date, row.dz_date) if value]
    earliest = min(dates) if dates else date.max
    return (0 if dates else 1, earliest, row.key)


def dva_check_lifecycle_from_rows(rows: Any) -> list[DvaCheckLifecycleRow]:
    result: list[DvaCheckLifecycleRow] = []
    for row in rows:
        serial = str(row.serial_number or "").strip() or WITHOUT_CHECK
        short_name = str(row.short_name or "").strip() or str(row.check_name or "").strip()
        check_id = getattr(row, "id", None)
        result.append(
            DvaCheckLifecycleRow(
                id=str(check_id) if check_id is not None else serial,
                key=serial,
                short_name=short_name,
                auditor=_auditor_display_name(row.name, WITHOUT_LEADER),
                order_date=row.order_document_date,
                program_date=row.program_document_date,
                az_date=row.az_document_date,
                dz_date=row.dz_document_date,
            )
        )
    return sorted(result, key=_lifecycle_sort_key)


async def dva_check_lifecycle_sql(session: AsyncSession, **filters: Any) -> list[DvaCheckLifecycleRow]:
    statement = apply_check_filters(
        select(
            Check.id,
            Check.serial_number,
            Check.short_name,
            Check.check_name,
            Check.check_leader.label("name"),
            Check.order_document_date,
            Check.program_document_date,
            Check.az_document_date,
            Check.dz_document_date,
        ).select_from(Check),
        **filters,
    )
    return dva_check_lifecycle_from_rows(await fetch_all(session, statement))


async def dva_document_readiness_sql(session: AsyncSession, **filters: Any) -> list[DocumentReadinessRow]:
    statement = apply_check_filters(
        select(
            func.count().label("total"),
            count_if(
                or_(Check.order_document_number.isnot(None), Check.order_document_date.isnot(None)),
                "order_filled",
            ),
            count_if(
                or_(Check.program_document_number.isnot(None), Check.program_document_date.isnot(None)),
                "program_filled",
            ),
            count_if(
                or_(Check.az_document_number.isnot(None), Check.az_document_date.isnot(None)),
                "az_filled",
            ),
            count_if(
                or_(Check.dz_document_number.isnot(None), Check.dz_document_date.isnot(None)),
                "dz_filled",
            ),
        ).select_from(Check),
        **filters,
    )
    row = await fetch_one(session, statement)
    total = int(row.total)
    docs = [
        ("Приказ", int(row.order_filled)),
        ("Программа", int(row.program_filled)),
        ("АЗ", int(row.az_filled)),
        ("ДЗ", int(row.dz_filled)),
    ]
    return [
        DocumentReadinessRow(name=name, filled=filled, empty=max(total - filled, 0))
        for name, filled in docs
    ]


async def dva_auditor_matrix_sql(
    session: AsyncSession,
    granularity: PeriodGranularity,
    *,
    check_filters: dict[str, Any],
    recommendation_filters: dict[str, Any],
) -> DvaAuditorMatrix:
    check_group = period_group_columns(Check.start_date, granularity)
    check_statement = apply_check_filters(
        select(
            Check.check_leader.label("auditor"),
            *check_group,
            func.count().label("checks"),
        )
        .select_from(Check)
        .group_by(Check.check_leader, *check_group),
        **check_filters,
    )
    rec_group = period_group_columns(Recommendation.deadline, granularity)
    rec_statement = apply_recommendation_filters(
        select(
            Recommendation.auditor.label("auditor"),
            *rec_group,
            func.count().label("recommendations"),
        )
        .select_from(Recommendation)
        .group_by(Recommendation.auditor, *rec_group),
        **recommendation_filters,
    )

    period_map: dict[str, PeriodBucketSchema] = {}
    row_map: dict[str, DvaAuditorMatrixRow] = {}

    def touch(auditor_raw: str) -> DvaAuditorMatrixRow:
        auditor = auditor_raw.strip() or UNSPECIFIED
        current = row_map.get(auditor)
        if current is None:
            current = DvaAuditorMatrixRow(auditor=auditor, total=0, by_period={})
            row_map[auditor] = current
        return current

    def add_cell(row: Any, *, checks: int = 0, recommendations: int = 0) -> None:
        period = period_from_sql_row(row, granularity)
        period_map[period.key] = PeriodBucketSchema(
            key=period.key,
            label=period.label,
            sort_key=period.sort_key,
        )
        matrix_row = touch(str(row.auditor))
        cell = matrix_row.by_period.get(period.key) or DvaAuditorMatrixCell(checks=0, recommendations=0)
        cell.checks += checks
        cell.recommendations += recommendations
        matrix_row.by_period[period.key] = cell
        matrix_row.total += checks + recommendations

    for row in await fetch_all(session, check_statement):
        add_cell(row, checks=int(row.checks))
    for row in await fetch_all(session, rec_statement):
        add_cell(row, recommendations=int(row.recommendations))

    return DvaAuditorMatrix(
        periods=sorted(period_map.values(), key=lambda item: item.sort_key),
        rows=sorted(row_map.values(), key=lambda item: (-item.total, item.auditor)),
    )
