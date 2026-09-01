from __future__ import annotations

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checks import Check
from app.schemas.analytics import (
    ChecksAnalyticsFilterOptions,
    ChecksAnalyticsResponse,
    EffectivenessMatrixRow,
    EffectivenessRatings,
    EffectivenessTones,
    PeriodGranularity,
)
from app.services.analytics.constants import (
    CHECK_TYPE_PLURAL_LABELS,
    EFFECTIVENESS_TONE_BY_LABEL,
    UNSET_EFFECTIVENESS_LABELS,
)
from app.services.analytics.params import check_params
from app.services.analytics.sql_aggregates import (
    check_period_series_sql,
    check_type_distribution_sql,
    check_view_distribution_sql,
    collect_check_anchor_dates_sql,
    collect_filter_option_auditors_sql,
    collect_filter_option_departments_sql,
    completion_share_from_summary,
    count_checks,
    department_map_from_pairs,
    load_check_department_pairs,
    load_effectiveness_matrix_rows,
    summarize_checks_sql,
)

__all__ = ["CHECK_TYPE_PLURAL_LABELS", "build_checks_analytics"]


def _resolve_effectiveness_tone(
    value: str | None,
) -> Literal["effective", "sufficient", "insufficient", "ineffective", "unset"]:
    raw = " ".join((value or "").strip().lower().split())
    if not raw or raw in UNSET_EFFECTIVENESS_LABELS:
        return "unset"
    return EFFECTIVENESS_TONE_BY_LABEL.get(raw, "unset")


def _effectiveness_matrix(checks: list[Check]) -> list[EffectivenessMatrixRow]:
    rows: list[EffectivenessMatrixRow] = []
    for check in checks:
        ratings = EffectivenessRatings(
            process=(check.process_effectiveness or "").strip(),
            svk=(check.svk_effectiveness or "").strip(),
            sur=(check.sur_effectiveness or "").strip(),
            svik=(check.svik_effectiveness or "").strip(),
        )
        rows.append(
            EffectivenessMatrixRow(
                id=str(check.id),
                key=check.serial_number,
                short_name=(check.short_name or "").strip(),
                name=check.check_name,
                ratings=ratings,
                tones=EffectivenessTones(
                    process=_resolve_effectiveness_tone(ratings.process),
                    svk=_resolve_effectiveness_tone(ratings.svk),
                    sur=_resolve_effectiveness_tone(ratings.sur),
                    svik=_resolve_effectiveness_tone(ratings.svik),
                ),
            )
        )
    return rows


async def build_checks_analytics(
    session: AsyncSession,
    *,
    granularity: PeriodGranularity = "year",
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
) -> ChecksAnalyticsResponse:
    filters = check_params(
        years=years,
        quarters=quarters,
        months=months,
        auditors=auditors,
        departments=departments,
    )
    summary = await summarize_checks_sql(session, **filters)
    department_pairs = await load_check_department_pairs(session, **filters)
    matrix_checks = await load_effectiveness_matrix_rows(session, **filters)
    return ChecksAnalyticsResponse(
        universe_total=await count_checks(session, filtered=False),
        filtered_total=summary.total,
        granularity=granularity,
        summary=summary,
        completion_share=completion_share_from_summary(summary),
        period_series=await check_period_series_sql(session, granularity, **filters),
        view_distribution=await check_view_distribution_sql(session, **filters),
        type_distribution=await check_type_distribution_sql(session, **filters),
        department_map=department_map_from_pairs(department_pairs, selected_departments=departments),
        effectiveness_matrix=_effectiveness_matrix(matrix_checks),
        filter_options=ChecksAnalyticsFilterOptions(
            auditors=await collect_filter_option_auditors_sql(session),
            departments=await collect_filter_option_departments_sql(session),
            anchor_dates=await collect_check_anchor_dates_sql(session),
        ),
    )
