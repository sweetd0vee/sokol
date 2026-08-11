from __future__ import annotations

from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recommendations import (
    Recommendation,
    RecommendationAdditionalStatus,
    RecommendationStatus,
)
from app.schemas.analytics import (
    ChecksAnalyticsFilterOptions,
    NamedCount,
    PeriodGranularity,
    RecommendationPeriodCount,
    RecommendationsAnalyticsResponse,
    RecommendationsSummary,
    RecommendationsSummaryByAdditional,
    RecommendationsSummaryByMateriality,
    RecommendationsSummaryByStatus,
)
from app.services.analytics.common import (
    collect_audit_objects,
    collect_recommendation_auditors,
    filter_recommendations,
    load_recommendations,
    pad_anchor_dates,
)
from app.services.analytics.period import get_period_bucket

STATUS_LABELS = {
    "completed": "Исполнено",
    "unresolved": "Не решено",
    "on_control": "На контроле",
    "in_progress": "В процессе",
}
ADDITIONAL_STATUS_LABELS = {
    "on_time": "В срок",
    "deadline_violated": "Срок нарушен",
    "on_control": "На контроле",
}
MATERIALITY_LABELS = {
    "низкий": "Низкий",
    "средний": "Средний",
    "высокий": "Высокий",
}
INDICATOR_LABELS = {
    "не указан": "Не указан",
    "в процессе": "В процессе",
    "ожидает": "Ожидает",
    "не решено": "Не решено",
    "исполнено": "Исполнено",
}
STATUS_COLORS = {
    "completed": "#22C55E",
    "unresolved": "#EF4444",
    "on_control": "#64748B",
    "in_progress": "#F59E0B",
}
ADDITIONAL_STATUS_COLORS = {
    "on_time": "#22C55E",
    "deadline_violated": "#EF4444",
    "on_control": "#64748B",
}
MATERIALITY_COLORS = {
    "низкий": "#22C55E",
    "средний": "#F59E0B",
    "высокий": "#EF4444",
}
INDICATOR_COLORS = {
    "не указан": "#D1D5DB",
    "в процессе": "#F59E0B",
    "ожидает": "#64748B",
    "не решено": "#EF4444",
    "исполнено": "#22C55E",
}


def _status_value(item: Recommendation) -> str:
    return item.status.value if hasattr(item.status, "value") else str(item.status)


def _additional_value(item: Recommendation) -> str:
    return (
        item.additional_status.value
        if hasattr(item.additional_status, "value")
        else str(item.additional_status)
    )


def summarize_recommendations(items: list[Recommendation]) -> RecommendationsSummary:
    by_status = {key.value: 0 for key in RecommendationStatus}
    by_materiality = {"низкий": 0, "средний": 0, "высокий": 0}
    by_additional = {key.value: 0 for key in RecommendationAdditionalStatus}

    for item in items:
        by_status[_status_value(item)] = by_status.get(_status_value(item), 0) + 1
        by_materiality[item.materiality_level] = by_materiality.get(item.materiality_level, 0) + 1
        by_additional[_additional_value(item)] = by_additional.get(_additional_value(item), 0) + 1

    with_extensions = sum(
        1
        for item in items
        if (
            (item.deadline_extensions and any(row.get("date") or row.get("comment") for row in item.deadline_extensions))
            or bool(item.extension_1_date or item.extension_1_comment or item.extension_2_comment)
        )
    )
    with_completion_date = sum(1 for item in items if item.actual_completion_date)
    total = len(items)
    completion_rate = round((by_status.get("completed", 0) / total) * 100) if total else 0
    violation_rate = round((by_additional.get("deadline_violated", 0) / total) * 100) if total else 0

    return RecommendationsSummary(
        total=total,
        by_status=RecommendationsSummaryByStatus(
            completed=by_status.get("completed", 0),
            unresolved=by_status.get("unresolved", 0),
            on_control=by_status.get("on_control", 0),
            in_progress=by_status.get("in_progress", 0),
        ),
        by_materiality=RecommendationsSummaryByMateriality(
            низкий=by_materiality.get("низкий", 0),
            средний=by_materiality.get("средний", 0),
            высокий=by_materiality.get("высокий", 0),
        ),
        by_additional=RecommendationsSummaryByAdditional(
            on_time=by_additional.get("on_time", 0),
            deadline_violated=by_additional.get("deadline_violated", 0),
            on_control=by_additional.get("on_control", 0),
        ),
        with_extensions=with_extensions,
        with_completion_date=with_completion_date,
        completion_rate=completion_rate,
        violation_rate=violation_rate,
    )


def build_recommendation_period_series(
    items: list[Recommendation],
    granularity: PeriodGranularity,
) -> list[RecommendationPeriodCount]:
    buckets: dict[str, RecommendationPeriodCount] = {}
    for item in items:
        if item.deadline is None:
            continue
        period = get_period_bucket(item.deadline, granularity)
        current = buckets.get(period.key)
        if current is None:
            current = RecommendationPeriodCount(
                key=period.key,
                label=period.label,
                sort_key=period.sort_key,
                total=0,
                completed=0,
                unresolved=0,
                on_control=0,
                in_progress=0,
                low=0,
                medium=0,
                high=0,
                cumulative=0,
                cumulative_completed=0,
            )
            buckets[period.key] = current
        current.total += 1
        status = _status_value(item)
        if status == "completed":
            current.completed += 1
        elif status == "unresolved":
            current.unresolved += 1
        elif status == "on_control":
            current.on_control += 1
        else:
            current.in_progress += 1
        if item.materiality_level == "низкий":
            current.low += 1
        elif item.materiality_level == "средний":
            current.medium += 1
        else:
            current.high += 1

    ordered = sorted(buckets.values(), key=lambda row: row.sort_key)
    running = 0
    completed_running = 0
    for row in ordered:
        running += row.total
        completed_running += row.completed
        row.cumulative = running
        row.cumulative_completed = completed_running
    return ordered


def _named_from_map(counts: dict[str, int], labels: dict[str, str], colors: dict[str, str] | None = None) -> list[NamedCount]:
    result: list[NamedCount] = []
    for key, value in counts.items():
        if value <= 0:
            continue
        result.append(
            NamedCount(
                name=labels.get(key, key),
                value=value,
                color=(colors or {}).get(key),
            )
        )
    return result


def build_status_distribution(summary: RecommendationsSummary) -> list[NamedCount]:
    counts = {
        "completed": summary.by_status.completed,
        "unresolved": summary.by_status.unresolved,
        "on_control": summary.by_status.on_control,
        "in_progress": summary.by_status.in_progress,
    }
    return _named_from_map(counts, STATUS_LABELS, STATUS_COLORS)


def build_additional_status_distribution(summary: RecommendationsSummary) -> list[NamedCount]:
    counts = {
        "on_time": summary.by_additional.on_time,
        "deadline_violated": summary.by_additional.deadline_violated,
        "on_control": summary.by_additional.on_control,
    }
    return _named_from_map(counts, ADDITIONAL_STATUS_LABELS, ADDITIONAL_STATUS_COLORS)


def build_materiality_distribution(summary: RecommendationsSummary) -> list[NamedCount]:
    counts = {
        "низкий": summary.by_materiality.низкий,
        "средний": summary.by_materiality.средний,
        "высокий": summary.by_materiality.высокий,
    }
    return _named_from_map(counts, MATERIALITY_LABELS, MATERIALITY_COLORS)


def build_indicator_distribution(items: list[Recommendation]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for item in items:
        counts[item.indicator or "не указан"] += 1
    return sorted(
        _named_from_map(counts, INDICATOR_LABELS, INDICATOR_COLORS),
        key=lambda row: (-row.value, row.name),
    )


def build_audit_object_distribution(items: list[Recommendation]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for item in items:
        name = (item.audit_object or "").strip() or "Без объекта"
        counts[name] += 1
    return [
        NamedCount(name=name, value=value)
        for name, value in sorted(counts.items(), key=lambda row: (-row[1], row[0]))
    ]


def build_check_link_distribution(items: list[Recommendation]) -> list[NamedCount]:
    counts: dict[str, int] = defaultdict(int)
    for item in items:
        key = (item.serial_number or "").strip() or "Без проверки"
        counts[key] += 1
    return [
        NamedCount(name=name, value=value)
        for name, value in sorted(counts.items(), key=lambda row: (-row[1], row[0]))[:12]
    ]


def _filter_options(items: list[Recommendation]) -> ChecksAnalyticsFilterOptions:
    return ChecksAnalyticsFilterOptions(
        auditors=collect_recommendation_auditors(items),
        departments=collect_audit_objects(items),
        anchor_dates=pad_anchor_dates([item.deadline for item in items if item.deadline]),
    )


async def build_recommendations_analytics(
    session: AsyncSession,
    *,
    granularity: PeriodGranularity = "year",
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    statuses: list[str] | None = None,
    additional_statuses: list[str] | None = None,
    materiality_levels: list[str] | None = None,
) -> RecommendationsAnalyticsResponse:
    all_items = await load_recommendations(session)
    filtered = filter_recommendations(
        all_items,
        auditors=auditors,
        departments=departments,
        statuses=statuses,
        additional_statuses=additional_statuses,
        materiality_levels=materiality_levels,
        years=years,
        quarters=quarters,
        months=months,
    )
    summary = summarize_recommendations(filtered)
    period_series = build_recommendation_period_series(filtered, granularity)
    return RecommendationsAnalyticsResponse(
        universe_total=len(all_items),
        filtered_total=len(filtered),
        granularity=granularity,
        summary=summary,
        period_series=period_series,
        cumulative_series=period_series,
        materiality_distribution=build_materiality_distribution(summary),
        indicator_distribution=build_indicator_distribution(filtered),
        check_links=build_check_link_distribution(filtered),
        object_distribution=build_audit_object_distribution(filtered),
        status_distribution=build_status_distribution(summary),
        additional_status_distribution=build_additional_status_distribution(summary),
        filter_options=_filter_options(all_items),
    )
